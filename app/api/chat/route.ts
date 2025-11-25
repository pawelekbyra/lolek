import { google } from 'ai/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';

export const runtime = 'edge';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: google('gemini-3-pro-previewt'),
    system: `You are "Lolek", a technical assistant.
Your primary goal is to expand your own capabilities based on user instructions.
You can read your own code, create feature branches, and propose code changes.
When asked to perform an action, use the available tools.
When you are done with the task, respond with a summary of your actions.`,
    messages,
    tools: {
      read_own_code: tool({
        description: 'Allows the agent to read a file from its own repository.',
        parameters: z.object({
          path: z.string().describe('The path to the file to read.'),
        }),
        execute: async ({ path }) => {
          console.log(`Reading code from: ${path}`);
          if (!GITHUB_TOKEN) {
            return { success: false, error: "GITHUB_TOKEN is not set." };
          }
          return { success: true, content: `// Mock content of ${path}` };
        },
      }),
      create_feature_branch: tool({
        description: 'Creates a new git branch for a new feature.',
        parameters: z.object({
          branchName: z.string().describe('The name of the new branch.'),
        }),
        execute: async ({ branchName }) => {
          console.log(`Creating feature branch: ${branchName}`);
          if (!GITHUB_TOKEN) {
            return { success: false, error: "GITHUB_TOKEN is not set." };
          }
          return { success: true, url: `https://github.com/example/repo/tree/${branchName}` };
        },
      }),
      propose_code_change: tool({
        description: 'Commits a file to a new branch.',
        parameters: z.object({
          branchName: z.string().describe('The branch to commit to.'),
          filePath: z.string().describe('The path of the file to commit.'),
          content: z.string().describe('The new content of the file.'),
        }),
        execute: async ({ branchName, filePath, content }) => {
          console.log(`Proposing code change to ${filePath} in branch ${branchName} with content: ${content}`);
          if (!GITHUB_TOKEN) {
            return { success: false, error: "GITHUB_TOKEN is not set." };
          }
          return { success: true, commitUrl: `https://github.com/example/repo/commit/mock_sha` };
        },
      }),
    },
  });

  return result.toAIStreamResponse();
}
