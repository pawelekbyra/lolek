import {
  streamText,
  UIMessage,
  convertToCoreMessages,
  tool,
  stepCountIs,
} from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { getChatMessages, addChatMessage } from '../../../lib/db-postgres';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
    }

    const personaPath = path.join(process.cwd(), 'lolek-persona.md');
    let system = "Jesteś pomocnym asystentem o imieniu Lolek."; // Fallback
    try {
      if (fs.existsSync(personaPath)) {
        system = fs.readFileSync(personaPath, 'utf-8');
      } else {
        console.warn('Persona file not found at:', personaPath);
      }
    } catch (err) {
      console.error("Error reading persona:", err);
    }

    const { messages, session_id: sessionId }: { messages: UIMessage[], session_id: string } = await req.json();

    // Fetch chat history from the database
    const initialMessages = await getChatMessages(sessionId);

    const result = streamText({
      model: google('gemini-3-pro-preview'),
      system,
      messages: [...convertToCoreMessages(initialMessages), ...convertToCoreMessages(messages)],
      onFinish: async ({ text }) => {
        // Save the user message and the assistant's response to the database
        const lastUserMessage = messages[messages.length - 1];
        const lastUserMessageContent = (lastUserMessage.parts as any[])
          .map(part => (part.type === 'text' ? part.text : '[image]'))
          .join(' ');
        await addChatMessage(sessionId, 'user', lastUserMessageContent);
        await addChatMessage(sessionId, 'assistant', text);
      },
      stopWhen: stepCountIs(5), // Enable multi-step tool calls
      tools: {
        web_search: tool({
          description: 'Pozwala znaleźć aktualne informacje w sieci.',
          inputSchema: z.object({
            query: z.string().describe('Pytanie do wyszukiwarki.'),
          }),
          execute: async ({ query }) => {
            const apiKey = process.env.TAVILY_API_KEY;
            if (!apiKey) {
              return { error: 'Brak klucza TAVILY_API_KEY w zmiennych środowiskowych.' };
            }
            try {
              const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  api_key: apiKey,
                  query: query,
                  max_results: 5,
                }),
              });
              if (!response.ok) {
                const errorBody = await response.text();
                return { error: `Błąd API Tavily: ${response.status} ${errorBody}` };
              }
              const data = await response.json();
              return { results: data.results };
            } catch (error: any) {
              return { error: `Nie udało się połączyć z Tavily: ${error.message}` };
            }
          },
        }),
        github_read_file: tool({
          description: 'Pobiera treść pliku z repozytorium GitHub.',
          inputSchema: z.object({
            path: z.string().describe('Ścieżka do pliku w repozytorium.'),
            owner: z.string().optional().default('pawelekbyra'),
            repo: z.string().optional().default('fak'),
          }),
          execute: async ({ path, owner, repo }) => {
            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN w zmiennych środowiskowych.' };
            try {
              const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              });
              if (!response.ok) return { error: `Błąd API GitHub: ${response.status} ${await response.text()}` };
              const data = await response.json();
              const content = Buffer.from(data.content, 'base64').toString('utf-8');
              return { path: data.path, content };
            } catch (error: any) {
              return { error: `Nie udało się odczytać pliku: ${error.message}` };
            }
          },
        }),
        github_create_issue: tool({
          description: 'Tworzy nowe Issue w repozytorium GitHub.',
          inputSchema: z.object({
            title: z.string().describe('Tytuł nowego Issue.'),
            body: z.string().describe('Treść Issue, np. opis błędu lub plan działania.'),
            owner: z.string().optional().default('pawelekbyra'),
            repo: z.string().optional().default('fak'),
          }),
          execute: async ({ title, body, owner, repo }) => {
            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN.' };
            try {
              const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, body }),
              });
              if (!response.ok) return { error: `Błąd API GitHub: ${response.status} ${await response.text()}` };
              const data = await response.json();
              return { status: 'success', url: data.html_url };
            } catch (error: any) {
              return { error: `Nie udało się utworzyć Issue: ${error.message}` };
            }
          },
        }),
        github_push_file: tool({
          description: 'Zapisuje lub aktualizuje plik w repozytorium GitHub.',
          inputSchema: z.object({
            path: z.string().describe('Ścieżka do pliku.'),
            content: z.string().describe('Nowa zawartość pliku.'),
            commitMessage: z.string().describe('Komunikat commitu.'),
            owner: z.string().optional().default('pawelekbyra'),
            repo: z.string().optional().default('fak'),
          }),
          execute: async ({ path, content, commitMessage, owner, repo }) => {
            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN.' };

            try {
              // Krok 1: Pobierz SHA istniejącego pliku (jeśli istnieje)
              let sha: string | undefined;
              const getFileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
              });
              if (getFileResponse.ok) {
                const fileData = await getFileResponse.json();
                sha = fileData.sha;
              } else if (getFileResponse.status !== 404) {
                 return { error: `Nie można pobrać SHA pliku: ${getFileResponse.statusText}` };
              }

              // Krok 2: Wyślij zaktualizowaną treść
              const pushResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: commitMessage,
                  content: Buffer.from(content).toString('base64'),
                  sha: sha, // Dodaj SHA, jeśli plik istnieje
                }),
              });

              if (!pushResponse.ok) return { error: `Błąd API GitHub (push): ${pushResponse.status} ${await pushResponse.text()}` };
              const data = await pushResponse.json();
              return { status: 'success', commit: data.commit.sha };
            } catch (error: any) {
              return { error: `Nie udało się zapisać pliku: ${error.message}` };
            }
          },
        }),
        vercel_redeploy: tool({
          description: 'Wymusza nowe wdrożenie (redeploy) najnowszej wersji produkcyjnej projektu na Vercel.',
          inputSchema: z.object({
             projectId: z.string().optional().describe('ID projektu Vercel. Domyślnie z process.env.VERCEL_PROJECT_ID'),
          }),
          execute: async ({ projectId }) => {
            const token = process.env.VERCEL_API_TOKEN;
            const project = projectId || process.env.VERCEL_PROJECT_ID;

            if (!token || !project) return { error: 'Brak konfiguracji Vercel (Token/ProjectID).' };

            try {
               // 1. Pobierz ostatni deployment produkcyjny, aby skopiować jego metadane
              const deploymentsRes = await fetch(
                `https://api.vercel.com/v6/deployments?projectId=${project}&limit=1&state=READY&target=production`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if(!deploymentsRes.ok) return { error: `Błąd pobierania deploymentu: ${deploymentsRes.statusText}` };

              const deploymentsData = await deploymentsRes.json();
              const latestDeployment = deploymentsData.deployments?.[0];

              if (!latestDeployment) return { error: 'Nie znaleziono ostatniego wdrożenia produkcyjnego.' };

              // 2. Wywołaj nowe wdrożenie z tymi samymi metadanymi (git-source)
              const redeployRes = await fetch(`https://api.vercel.com/v13/deployments`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: latestDeployment.name,
                  gitSource: latestDeployment.meta,
                  target: 'production'
                })
              });

              if(!redeployRes.ok) return { error: `Błąd wywołania redeploy: ${await redeployRes.text()}` };
              const data = await redeployRes.json();

              return { status: 'success', message: 'Rozpoczęto nowe wdrożenie.', details: data };
            } catch (error: any) {
              return { error: `Błąd krytyczny Vercel API: ${error.message}` };
            }
          }
        }),
        vercel_get_logs: tool({
            description: 'Pobierz ostatnie logi (opcjonalnie błędy) z Vercel dla konkretnego lub ostatniego wdrożenia.',
            inputSchema: z.object({
                deploymentId: z.string().optional().describe('ID wdrożenia. Jeśli brak, pobiera z ostatniego.'),
                limit: z.number().optional().default(50),
                onlyErrors: z.boolean().optional().default(true).describe('Czy filtrować tylko logi typu "error".')
            }),
            execute: async ({ deploymentId, limit, onlyErrors }) => {
                const token = process.env.VERCEL_API_TOKEN;
                const projectId = process.env.VERCEL_PROJECT_ID;
                if (!token || !projectId) return { error: 'Brak konfiguracji Vercel.' };

                let targetDeploymentId = deploymentId;

                try {
                    if (!targetDeploymentId) {
                        const deploymentsRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&state=READY`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const deploymentsData = await deploymentsRes.json();
                        targetDeploymentId = deploymentsData.deployments?.[0]?.uid;
                        if (!targetDeploymentId) return { error: 'Nie znaleziono aktywnego wdrożenia.' };
                    }

                    const query = onlyErrors ? 'error' : '';
                    const logsRes = await fetch(`https://api.vercel.com/v2/now/deployments/${targetDeploymentId}/events?limit=${limit}&q=${query}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const logs = await logsRes.json();

                    return {
                        status: 'success',
                        deploymentId: targetDeploymentId,
                        logs: logs.length > 0 ? logs : 'Brak logów spełniających kryteria.'
                    };
                } catch (error: any) {
                    return { error: `Błąd podczas łączenia z Vercel: ${error.message}` };
                }
            }
        }),
        delegateTaskToJules: tool({
          description: 'Zleć zadanie programistyczne agentowi Jules (np. naprawę błędu na podstawie logów).',
          inputSchema: z.object({
            taskDescription: z.string().describe('Szczegółowy opis zadania, w tym treść błędu z logów jeśli dostępna.'),
            repoName: z.string().describe('Nazwa repozytorium GitHub (np. pawelekbyra/fak).'),
          }),
          execute: async ({ taskDescription, repoName }) => {
            const apiKey = process.env.JULES_API_KEY;
            if (!apiKey) return { error: 'Brak klucza API Julesa.' };

            try {
              // Symulacja wywołania API Julesa (dostosuj endpoint do oficjalnej dokumentacji jeśli inna)
              const response = await fetch('https://jules.googleapis.com/v1alpha/sessions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                },
                body: JSON.stringify({
                  prompt: taskDescription,
                  sourceContext: {
                    source: `sources/github/${repoName}`,
                    githubRepoContext: { startingBranch: "main" }
                  },
                  automationMode: "AUTO_CREATE_PR"
                })
              });

              if (!response.ok) throw new Error(`Jules API Error: ${response.statusText}`);
              const data = await response.json();

              return {
                status: 'Zadanie zlecone',
                message: `Jules rozpoczął pracę nad: "${taskDescription}". Oczekuj na Pull Request.`,
                sessionId: data.name || 'unknown'
              };
            } catch (error: any) {
              return { error: `Nie udało się zlecić zadania: ${error.message}` };
            }
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error('Error in /api/lolek:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred while processing your request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
