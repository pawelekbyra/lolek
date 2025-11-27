import {
  streamText,
  UIMessage,
  convertToCoreMessages,
  tool,
  stepCountIs,
  generateObject,
} from 'ai';
import { google } from '@ai-sdk/google';
import { observe } from 'langfuse-vercel';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { getChatMessages, addChatMessage } from '../../../lib/db-postgres';
import { getEmbedding } from '../../../lib/embedding';
import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import vm from 'vm';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
    }

    const myRepoOwner = process.env.NEXT_PUBLIC_MY_REPO_OWNER || 'pawelekbyra';
    const myRepoName = process.env.NEXT_PUBLIC_MY_REPO_NAME || 'lolek';
    const myProjectId = process.env.VERCEL_PROJECT_ID || 'prj_GPzLdsmmg9Fj3R5RkYpPmyoEwvDW';

    const cheapModel = google('gemini-2.5-flash-lite');
    const smartModel = google('gemini-3-pro-preview');

    const personaPath = path.join(process.cwd(), 'lolek-persona.md');
    let system = "Jesteś pomocnym asystentem o imieniu Lolek."; // Fallback
    try {
      await fs.access(personaPath);
      system = await fs.readFile(personaPath, 'utf-8');
    } catch (err) {
      console.warn('Persona file not found at:', personaPath);
    }

    const { messages, session_id: sessionId }: { messages: UIMessage[], session_id: string } = await req.json();

    // Hardcoded userId until auth is implemented
    const userId = "a0184a30-3151-4621-a249-51a87b1c19b6";

    // Fetch chat history from the database
    const initialMessages = await getChatMessages(sessionId);

    const lastUserMessage = messages[messages.length - 1];
    const lastUserMessageContent = (lastUserMessage.parts as any[])
      .find(part => part.type === 'text')?.text || '';

    let selectedModel = smartModel;

    try {
      const { object: router } = await generateObject({
        model: cheapModel,
        schema: z.object({
          isComplex: z.boolean().describe(
            'Set to true if the request involves coding, debugging, long analysis, or using tools (like GitHub/Vercel). Set to false for greetings, small talk, or simple facts.'
          ),
          reason: z.string(),
        }),
        prompt: `Analyze the following user query and decide if it requires a powerful "smart" model or if a simpler "cheap" model can handle it. The user query is: "${lastUserMessageContent}"`,
      });

      if (router.isComplex) {
        selectedModel = smartModel;
        console.log(`[Router] Selected: smartModel. Reason: ${router.reason}`);
      } else {
        selectedModel = cheapModel;
        console.log(`[Router] Selected: cheapModel. Reason: ${router.reason}`);
      }
    } catch (error) {
      selectedModel = smartModel;
      console.log('[Router] Selected: smartModel. Reason: Failed to route, defaulting to smart model.');
    }

    // RAG: Retrieve long-term memory
    let memoryContext = '';
    if (lastUserMessageContent) {
      try {
        const queryEmbedding = await getEmbedding(lastUserMessageContent);
        const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

        const similarMemories: { content: string; similarity: number }[] = await prisma.$queryRaw`
          SELECT content, 1 - (embedding <=> ${queryEmbeddingString}::vector) as similarity
          FROM "SemanticMemory"
          WHERE "userId" = ${userId} AND 1 - (embedding <=> ${queryEmbeddingString}::vector) > 0.7
          ORDER BY similarity DESC;
        `;

        if (similarMemories.length > 0) {
          memoryContext = "Here is some relevant context from your long-term memory:\n" +
                          similarMemories.map(mem => `- ${mem.content}`).join('\n');
          console.log("Retrieved memories:", memoryContext);
        }
      } catch (error) {
        console.error("Failed to retrieve memories:", error);
      }
    }

    const operationalAwareness = `
      OPERATIONAL SELF-AWARENESS (CRITICAL):
      YOU ARE the application running from the file "app/api/lolek/route.ts".
      DO NOT confuse yourself with other endpoints like "chat/route.ts".
      Your source code resides in GitHub: "${myRepoOwner}/${myRepoName}".
      You are deployed on Vercel Project ID: "${myProjectId}".
      The tools defined in this file (e.g., delegateTaskToJules, vercel_get_logs) ARE YOUR TOOLS. You have access to them directly.
    `;

    const finalSystem = `${system}\n${memoryContext ? `\n### LONG-TERM MEMORY CONTEXT:\n${memoryContext}` : ''}\n${operationalAwareness}`;

    const result = streamText({
      model: selectedModel,
      system: finalSystem,
      messages: [...convertToCoreMessages(initialMessages), ...convertToCoreMessages(messages)],
      experimental_telemetry: observe({
         projectId: myProjectId,
         metadata: {
             userId,
             sessionId,
         }
      }),
      onFinish: async ({ text }) => {
        const lastUserMessageContentForDb = (lastUserMessage.parts as any[])
          .map(part => (part.type === 'text' ? part.text : '[image]'))
          .join(' ');
        await addChatMessage(sessionId, userId, 'user', lastUserMessageContentForDb);
        await addChatMessage(sessionId, userId, 'assistant', text);
      },
      stopWhen: stepCountIs(5), // Enable multi-step tool calls
      tools: {
        save_memory: tool({
          description: 'Saves important information, user preferences, or facts into long-term memory.',
          inputSchema: z.object({
            content: z.string().describe('The information to save.'),
            tags: z.array(z.string()).optional().describe('Optional tags to categorize the memory.'),
          }),
          execute: async ({ content, tags }) => {
            try {
              const embedding = await getEmbedding(content);
              const embeddingString = `[${embedding.join(',')}]`;

              // Use raw SQL to insert the vector
              await prisma.$executeRaw`
                INSERT INTO "SemanticMemory" (id, "userId", content, embedding, source)
                VALUES (gen_random_uuid(), ${userId}, ${content}, ${embeddingString}::vector, 'Lolek Self-Correction');
              `;

              return { status: 'success', message: `Memory saved: "${content}"` };
            } catch (error: any) {
              console.error('Failed to save memory:', error);
              return { error: `Could not save memory: ${error.message}` };
            }
          },
        }),
        vercel_api_request: tool({
          description: 'Pozwala na wykonanie dowolnego surowego zapytania do API Vercel.',
          inputSchema: z.object({
            endpoint: z.string().describe('Ścieżka API Vercel, np. /v9/projects'),
            method: z.string().optional().default('GET').describe('Metoda HTTP (GET, POST, PUT, DELETE, etc.).'),
            body: z.string().optional().describe('Ciało zapytania w formacie JSON (dla metod POST, PUT, etc.).'),
          }),
          execute: async ({ endpoint, method, body }) => {
            const token = process.env.VERCEL_API_TOKEN;
            if (!token) {
              return { error: 'Brak VERCEL_API_TOKEN w zmiennych środowiskowych.' };
            }

            try {
              const url = `https://api.vercel.com${endpoint}`;
              const options: RequestInit = {
                method: method?.toUpperCase() || 'GET',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              };

              if (body && (method?.toUpperCase() !== 'GET' && method?.toUpperCase() !== 'HEAD')) {
                options.body = body;
              }

              const response = await fetch(url, options);
              const responseData = await response.json().catch(() => response.text());

              if (!response.ok) {
                return {
                  error: `Błąd API Vercel: ${response.status}`,
                  details: responseData,
                };
              }

              return { status: response.status, response: responseData };
            } catch (error: any) {
              return { error: `Nie udało się wykonać zapytania do Vercel API: ${error.message}` };
            }
          },
        }),
        github_api_request: tool({
          description: 'Pozwala na wykonanie dowolnego surowego zapytania do API GitHub.',
          inputSchema: z.object({
            path: z.string().describe('Ścieżka API, np. /repos/owner/repo/issues'),
            method: z.string().optional().default('GET').describe('Metoda HTTP (GET, POST, PUT, DELETE, etc.).'),
            body: z.string().optional().describe('Ciało zapytania w formacie JSON (dla metod POST, PUT, etc.).'),
          }),
          execute: async ({ path, method, body }) => {
            const token = process.env.GITHUB_TOKEN;
            if (!token) {
              return { error: 'Brak GITHUB_TOKEN w zmiennych środowiskowych.' };
            }

            try {
              const url = `https://api.github.com${path}`;
              const options: RequestInit = {
                method: method?.toUpperCase() || 'GET',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json',
                },
              };

              if (body && (method?.toUpperCase() !== 'GET' && method?.toUpperCase() !== 'HEAD')) {
                options.body = body;
              }

              const response = await fetch(url, options);
              const responseData = await response.json().catch(() => response.text());

              if (!response.ok) {
                return {
                  error: `Błąd API GitHub: ${response.status}`,
                  details: responseData,
                };
              }

              return { status: response.status, response: responseData };
            } catch (error: any) {
              return { error: `Nie udało się wykonać zapytania do GitHub API: ${error.message}` };
            }
          },
        }),
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
          description: 'Pobiera treść pliku z repozytorium GitHub z określonej gałęzi (branch).',
          inputSchema: z.object({
            path: z.string().describe('Ścieżka do pliku w repozytorium.'),
            branch: z.string().optional().describe("Nazwa gałęzi (brancha). Domyślnie używana jest główna gałąź repozytorium."),
            owner: z.string().optional().default(myRepoOwner),
            repo: z.string().optional().default(myRepoName),
          }),
          execute: async ({ path, branch, owner, repo }) => {
            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN w zmiennych środowiskowych.' };
            try {
              const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
              if (branch) {
                url.searchParams.append('ref', branch);
              }

              const response = await fetch(url.toString(), {
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
            owner: z.string().optional().default(myRepoOwner),
            repo: z.string().optional().default(myRepoName),
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
          description: 'Zapisuje lub aktualizuje plik w repozytorium GitHub na określonej gałęzi (branch).',
          inputSchema: z.object({
            path: z.string().describe('Ścieżka do pliku.'),
            content: z.string().describe('Nowa zawartość pliku.'),
            commitMessage: z.string().describe('Komunikat commitu.'),
            branch: z.string().optional().describe("Nazwa gałęzi (brancha), na której ma być zapisany plik. Jeśli nie podana, używana jest główna gałąź."),
            owner: z.string().optional().default(myRepoOwner),
            repo: z.string().optional().default(myRepoName),
            confirm: z.boolean().optional().default(false).describe('Wymagane potwierdzenie użytkownika. Ustaw na true, jeśli użytkownik zatwierdził akcję.'),
          }),
          execute: async ({ path, content, commitMessage, branch, owner, repo, confirm }) => {
            if (!confirm) {
              return {
                status: 'requires_approval',
                message: 'Ta akcja wymaga zatwierdzenia przez użytkownika. Użyj parametru confirm=true, gdy otrzymasz zgodę.',
                args: { path, content: '(hidden)', commitMessage, branch, owner, repo }
              };
            }

            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN.' };

            try {
              const getFileUrl = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
              if (branch) {
                getFileUrl.searchParams.append('ref', branch);
              }

              let sha: string | undefined;
              const getFileResponse = await fetch(getFileUrl.toString(), {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
              });
              if (getFileResponse.ok) {
                const fileData = await getFileResponse.json();
                sha = fileData.sha;
              } else if (getFileResponse.status !== 404) {
                return { error: `Nie można pobrać SHA pliku: ${getFileResponse.statusText}` };
              }

              const pushUrl = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
              const requestBody: any = {
                message: commitMessage,
                content: Buffer.from(content).toString('base64'),
                sha: sha,
              };
              if (branch) {
                requestBody.branch = branch;
              }

              const pushResponse = await fetch(pushUrl.toString(), {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });

              if (!pushResponse.ok) return { error: `Błąd API GitHub (push): ${pushResponse.status} ${await pushResponse.text()}` };
              const data = await pushResponse.json();
              return { status: 'success', commit: data.commit.sha };
            } catch (error: any) {
              return { error: `Nie udało się zapisać pliku: ${error.message}` };
            }
          },
        }),
        github_list_files: tool({
          description: 'Listuje wszystkie pliki w repozytorium GitHub (rekurencyjnie).',
          inputSchema: z.object({
            owner: z.string().optional().default(myRepoOwner),
            repo: z.string().optional().default(myRepoName),
            branch: z.string().optional().default('main'),
          }),
          execute: async ({ owner, repo, branch }) => {
            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN.' };
            try {
              const branchShaResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
              });
              if (!branchShaResponse.ok) return { error: 'Nie można pobrać SHA gałęzi.' };
              const branchData = await branchShaResponse.json();
              const treeSha = branchData.object.sha;

              const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
              });
              if (!treeResponse.ok) return { error: 'Nie można pobrać drzewa plików.' };
              const treeData = await treeResponse.json();

              return { files: treeData.tree.map((file: any) => file.path) };
            } catch (error: any) {
              return { error: `Błąd: ${error.message}` };
            }
          },
        }),
        github_create_branch: tool({
          description: 'Tworzy nową gałąź (branch) w repozytorium GitHub.',
          inputSchema: z.object({
            branchName: z.string().describe('Nazwa nowej gałęzi.'),
            fromBranch: z.string().optional().default('main').describe('Nazwa gałęzi, z której ma powstać nowa.'),
            owner: z.string().optional().default(myRepoOwner),
            repo: z.string().optional().default(myRepoName),
            confirm: z.boolean().optional().default(false).describe('Wymagane potwierdzenie użytkownika. Ustaw na true, jeśli użytkownik zatwierdził akcję.'),
          }),
          execute: async ({ branchName, fromBranch, owner, repo, confirm }) => {
            if (!confirm) {
              return {
                status: 'requires_approval',
                message: 'Ta akcja wymaga zatwierdzenia przez użytkownika. Użyj parametru confirm=true, gdy otrzymasz zgodę.',
                args: { branchName, fromBranch, owner, repo }
              };
            }

            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN.' };
            try {
              const fromBranchShaResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
              });
              if (!fromBranchShaResponse.ok) return { error: `Nie można pobrać SHA gałęzi '${fromBranch}'.` };
              const fromBranchData = await fromBranchShaResponse.json();
              const sha = fromBranchData.object.sha;

              const createBranchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
              });

              if (!createBranchResponse.ok) {
                 const errorData = await createBranchResponse.json();
                 return { error: `Nie udało się utworzyć gałęzi: ${errorData.message}` };
              }
              const data = await createBranchResponse.json();
              return { status: 'success', ref: data.ref };
            } catch (error: any) {
              return { error: `Błąd krytyczny: ${error.message}` };
            }
          },
        }),
        github_create_pull_request: tool({
          description: 'Tworzy Pull Request w repozytorium GitHub.',
          inputSchema: z.object({
            title: z.string().describe('Tytuł Pull Requesta.'),
            body: z.string().describe('Opis Pull Requesta.'),
            head: z.string().describe('Nazwa gałęzi, z której pochodzą zmiany.'),
            base: z.string().optional().default('main').describe('Nazwa gałęzi docelowej.'),
            owner: z.string().optional().default(myRepoOwner),
            repo: z.string().optional().default(myRepoName),
            confirm: z.boolean().optional().default(false).describe('Wymagane potwierdzenie użytkownika. Ustaw na true, jeśli użytkownik zatwierdził akcję.'),
          }),
          execute: async ({ title, body, head, base, owner, repo, confirm }) => {
            if (!confirm) {
              return {
                status: 'requires_approval',
                message: 'Ta akcja wymaga zatwierdzenia przez użytkownika. Użyj parametru confirm=true, gdy otrzymasz zgodę.',
                args: { title, body, head, base, owner, repo }
              };
            }

            const token = process.env.GITHUB_TOKEN;
            if (!token) return { error: 'Brak GITHUB_TOKEN.' };
            try {
              const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, head, base }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                return { error: `Błąd API GitHub: ${response.status} ${errorText}` };
              }
              const data = await response.json();
              return { status: 'success', url: data.html_url };
            } catch (error: any) {
              return { error: `Nie udało się utworzyć Pull Requesta: ${error.message}` };
            }
          },
        }),
        vercel_redeploy: tool({
          description: 'Wymusza nowe wdrożenie (redeploy) najnowszej wersji produkcyjnej projektu na Vercel.',
          inputSchema: z.object({
             projectId: z.string().optional().default(myProjectId),
             confirm: z.boolean().optional().default(false).describe('Wymagane potwierdzenie użytkownika. Ustaw na true, jeśli użytkownik zatwierdził akcję.'),
          }),
          execute: async ({ projectId, confirm }) => {
            if (!confirm) {
              return {
                status: 'requires_approval',
                message: 'Ta akcja wymaga zatwierdzenia przez użytkownika. Użyj parametru confirm=true, gdy otrzymasz zgodę.',
                args: { projectId }
              };
            }

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
                projectId: z.string().optional().default(myProjectId),
                deploymentId: z.string().optional().describe('ID wdrożenia. Jeśli brak, pobiera z ostatniego.'),
                limit: z.number().optional().default(50),
                onlyErrors: z.boolean().optional().default(true).describe('Czy filtrować tylko logi typu "error".')
            }),
            execute: async ({ projectId, deploymentId, limit, onlyErrors }) => {
                const token = process.env.VERCEL_API_TOKEN;
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
        vercel_add_env: tool({
          description: 'Adds a new environment variable to the Vercel project.',
          inputSchema: z.object({
            key: z.string().describe('The name of the environment variable (e.g., "TAVILY_API_KEY").'),
            value: z.string().describe('The value of the environment variable.'),
            targets: z.array(z.string()).optional().default(['production', 'preview', 'development']).describe('The environments the variable should apply to.'),
            projectId: z.string().optional().default(myProjectId).describe('The Vercel project ID.'),
          }),
          execute: async ({ key, value, targets, projectId }) => {
            const token = process.env.VERCEL_API_TOKEN;
            if (!token || !projectId) {
              return { error: 'Vercel configuration (Token/ProjectID) is missing.' };
            }

            try {
              const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key,
                  value,
                  type: 'encrypted',
                  target: targets,
                }),
              });

              if (!response.ok) {
                const errorBody = await response.json();
                if (errorBody.error?.code === 'env_var_key_already_exists') {
                   return { error: `Environment variable '${key}' already exists.` };
                }
                return { error: `Vercel API Error: ${response.status} ${JSON.stringify(errorBody)}` };
              }

              const data = await response.json();
              return { status: 'success', message: `Environment variable '${key}' added successfully.`, details: data };
            } catch (error: any) {
              return { error: `Failed to add environment variable: ${error.message}` };
            }
          },
        }),
        generate_canvas_content: tool({
          description: 'Write a long report, article, or code to the side canvas.',
          inputSchema: z.object({
            title: z.string(),
            type: z.enum(['markdown', 'code']),
            content: z.string().describe('The full markdown content or code')
          })
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
        database_execute_raw: tool({
          description: 'Executes a raw SQL query against the database. WARNING: This tool can cause irreversible data loss and should be used with extreme caution.',
          inputSchema: z.object({
            query: z.string().describe('The raw SQL query to execute.'),
            parameters: z.array(z.any()).optional().describe('An array of parameters to pass to the query.'),
            confirm: z.boolean().optional().default(false).describe('Wymagane potwierdzenie użytkownika. Ustaw na true, jeśli użytkownik zatwierdził akcję.'),
          }),
          execute: async ({ query, parameters, confirm }) => {
            if (!confirm) {
              return {
                status: 'requires_approval',
                message: 'Ta akcja wymaga zatwierdzenia przez użytkownika. Użyj parametru confirm=true, gdy otrzymasz zgodę.',
                args: { query, parameters }
              };
            }
            try {
              const result = await (prisma as any).$queryRawUnsafe(query, ...(parameters || []));
              return { status: 'success', result };
            } catch (error: any) {
              return { error: `Failed to execute query: ${error.message}` };
            }
          },
        }),
        run_utility_script: tool({
          description: 'Runs a utility script in a sandboxed environment. WARNING: This tool can execute arbitrary code and is a major security risk. If execution fails, analyze the error and try to fix the code (Self-Correction).',
          inputSchema: z.object({
            code: z.string().describe('The code to execute.'),
            language: z.enum(['javascript', 'python']).describe('The language of the code.'),
            confirm: z.boolean().optional().default(false).describe('Wymagane potwierdzenie użytkownika. Ustaw na true, jeśli użytkownik zatwierdził akcję.'),
          }),
          execute: async ({ code, language, confirm }) => {
            if (!confirm) {
              return {
                status: 'requires_approval',
                message: 'Ta akcja wymaga zatwierdzenia przez użytkownika. Użyj parametru confirm=true, gdy otrzymasz zgodę.',
                args: { code, language }
              };
            }
            if (language === 'javascript') {
              try {
                const sandbox = {};
                vm.createContext(sandbox);
                const result = vm.runInContext(code, sandbox);
                return { status: 'success', result };
              } catch (error: any) {
                return {
                  status: 'error',
                  error: `Failed to execute javascript: ${error.message}`,
                  instruction: "Analyze the error message and retry with corrected code."
                };
              }
            } else if (language === 'python') {
              return new Promise((resolve) => {
                const python = spawn('python', ['-c', code]);
                let stdout = '';
                let stderr = '';
                python.stdout.on('data', (data) => {
                  stdout += data.toString();
                });
                python.stderr.on('data', (data) => {
                  stderr += data.toString();
                });
                python.on('close', (code) => {
                  if (code === 0) {
                    resolve({ status: 'success', stdout });
                  } else {
                    resolve({
                      status: 'error',
                      error: `Failed to execute python. Stderr: ${stderr}`,
                      stderr,
                      instruction: "The code execution failed. Analyze the stderr, fix the code, and try again."
                    });
                  }
                });
              });
            }
          },
        }),
        schema_manager: tool({
          description: 'Manages the database schema. WARNING: The migrate action can cause irreversible data loss and should be used with extreme caution.',
          inputSchema: z.object({
            action: z.enum(['read', 'update', 'migrate']).describe('The action to perform.'),
            content: z.string().optional().describe('The new content of the schema.prisma file.'),
            migration_name: z.string().optional().describe('The name of the migration.'),
            confirm: z.boolean().optional().default(false).describe('Wymagane potwierdzenie użytkownika. Ustaw na true, jeśli użytkownik zatwierdził akcję.'),
          }),
          execute: async ({ action, content, migration_name, confirm }) => {
            if (action !== 'read' && !confirm) {
              return {
                status: 'requires_approval',
                message: 'Ta akcja wymaga zatwierdzenia przez użytkownika. Użyj parametru confirm=true, gdy otrzymasz zgodę.',
                args: { action, content: '(hidden)', migration_name }
              };
            }

            const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
            if (action === 'read') {
              try {
                const schema = await fs.readFile(schemaPath, 'utf-8');
                return { status: 'success', schema };
              } catch (error: any) {
                return { error: `Failed to read schema: ${error.message}` };
              }
            } else if (action === 'update') {
              if (!content) {
                return { error: 'Content is required for the update action.' };
              }
              try {
                await fs.writeFile(schemaPath, content);
                return { status: 'success', message: 'Schema updated successfully.' };
              } catch (error: any) {
                return { error: `Failed to update schema: ${error.message}` };
              }
            } else if (action === 'migrate') {
              if (!migration_name) {
                return { error: 'Migration name is required for the migrate action.' };
              }
              return new Promise((resolve) => {
                const prismaMigrate = spawn('npx', ['prisma', 'migrate', 'dev', '--name', migration_name]);
                let stdout = '';
                let stderr = '';
                prismaMigrate.stdout.on('data', (data) => {
                  stdout += data.toString();
                });
                prismaMigrate.stderr.on('data', (data) => {
                  stderr += data.toString();
                });
                prismaMigrate.on('close', (code) => {
                  if (code === 0) {
                    resolve({ status: 'success', stdout });
                  } else {
                    resolve({ error: `Failed to migrate: ${stderr}`, stderr });
                  }
                });
              });
            }
          },
        }),
        manage_resource: tool({
          description: 'Manages structured data resources. Allows creating, updating, deleting, and listing records for any database model, including bulk operations.',
          inputSchema: z.object({
            model: z.string().describe("The name of the model to interact with (e.g., 'Journalist', 'User'). Case-insensitive."),
            action: z.enum(['create', 'update', 'delete', 'list', 'updateMany', 'deleteMany']).describe("The operation to perform."),
            data: z.any().describe("The data for the operation. For 'create'/'update'/'updateMany', this is the record data. For 'delete'/'deleteMany'/'list', this can be a 'where' clause."),
          }),
          execute: async ({ model, action, data }) => {
            if (!model || model.startsWith('_') || model.startsWith('$')) {
              return { error: `Invalid model name provided: ${model}` };
            }

            // Handle case-insensitivity: convert PascalCase to camelCase for Prisma Client
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);

            const prismaModel = (prisma as any)[modelName];
            if (!prismaModel) {
              return { error: `Model '${modelName}' not found on Prisma client.` };
            }

            const finalAction = action === 'list' ? 'findMany' : action;

            if (typeof prismaModel[finalAction] !== 'function') {
              return { error: `Action '${finalAction}' is not a valid function on model '${modelName}'.` };
            }

            try {
              const result = await prismaModel[finalAction](data);
              return { status: 'success', result };
            } catch (error: any) {
              console.error(`Error in manage_resource for ${modelName}.${finalAction}:`, error);
              return { error: `Operation failed: ${error.message}`, stack: error.stack };
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
