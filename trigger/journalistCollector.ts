import { client } from "./client";
import { eventTrigger } from "@trigger.dev/sdk";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

const prisma = new PrismaClient();

// Define input schema for the job
const jobInputSchema = z.object({
  userId: z.string(),
  initialQuery: z.string().optional(),
});

export const journalistCollector = client.defineJob({
  id: "journalist-collector",
  name: "Journalist Data Collector",
  version: "1.0.1",
  trigger: eventTrigger({
    name: "start-journalist-collection",
    schema: jobInputSchema,
  }),
  run: async (payload, io, ctx) => {
    const { userId, initialQuery } = payload;

    // Log start
    await io.logger.info("Starting Journalist Collector task", { userId, initialQuery });

    // Initialize state or get from DB if resuming
    const memoryKey = `JournalistCollector-${userId}`;

    // We fetch the initial state in a runTask to ensure it's memoized but here it's fine to read from DB once at start of function?
    // Actually, on resume, we might want to re-read the DB if we crashed?
    // Trigger v2 replay means the function runs from top.
    // If we read DB outside runTask, it executes every time.
    // But since we want to resume from *persisted* state, reading DB is what we want.
    // However, for deterministic replay, better to wrap it or rely on the logic below.

    // Actually, the loop state `currentQuery` needs to be managed carefully.
    // In Trigger v2, we should use the loop structure provided or just standard JS loop with runTask inside.

    let currentQuery = await io.runTask("get-initial-state", async () => {
         const savedMemory = await prisma.proceduralMemory.findFirst({
            where: { toolId: memoryKey }
        });
        // If we have saved memory, use it. ONLY use initialQuery if no memory exists.
        if (savedMemory && savedMemory.steps) {
            return savedMemory.steps;
        }
        return initialQuery || "dziennikarze email Polska";
    });

    await io.logger.info(`Starting with query: ${currentQuery}`);

    let isRunning = true;
    const maxDuration = 10 * 60 * 60 * 1000; // 10 hours
    // Use the run startedAt time from context to ensure consistent duration check across replays
    const startTime = ctx.run.startedAt.getTime();

    // In V2, loops can be standard while loops as long as everything inside is runTask.

    let iterationCount = 0;

    while (isRunning) {
        iterationCount++;
        // Use iteration count as key suffix to ensure uniqueness but determinism within the loop structure
        // Note: In strict V2 replay, local variables reset. We rely on the fact that io.runTask caches results.
        // If we restart, iterationCount is 0.
        // But io.runTask("search-1") will return cached result.
        // io.runTask("search-2") etc.
        // So we just need to ensure we don't accidentally reuse keys if we logically wanted a NEW step.
        // But here we want to replay history. So iterationCount starting at 0 and incrementing matches the history log.
        // So "search-1" corresponds to the first search ever done in this run.

        // However, Date.now() in the key is dangerous if it's not wrapped!
        // The previous code had `iter-${iterationCount}-${Date.now()}` which is BAD because it changes on replay.
        // Fixed to use just iterationCount.
        // If we rely on `currentQuery` being updated at the end of loop via DB,
        // when we restart, we fetch `currentQuery` from DB (in the first step above).
        // So the loop starts fresh but with the correct query.
        // So we don't need to worry about "replaying previous iterations" because the function *actually* restarts.
        // Wait, Trigger.dev V2 *replays* the function execution history from the log.
        // If we have a loop, it replays the loop iterations.
        // If the history gets too long, it might be an issue.
        // But for 10 hours?
        // Trigger.dev documentation says "Long running jobs" should be split or use specific patterns.
        // But with standard V2, the history limit is the main constraint.
        // If we assume a few iterations per minute, 10 hours is huge.
        // The user asked for "up to 10 hours".
        // Standard V2 might struggle with thousands of steps in one run.
        // Ideally we would recursively trigger the job itself?
        // "Resumability" via DB suggests we can just finish and restart.
        // But let's implement the loop with runTask as requested.

        // 1. Check status (wrapped in runTask)
        const shouldContinue = await io.runTask(`check-status-${iterationCount}`, async () => {
             const task = await prisma.longTermTask.findFirst({
                where: {
                    userId: userId,
                    status: 'in_progress'
                }
            });
            if (!task) return false;
            if (Date.now() - startTime > maxDuration) {
                 await prisma.longTermTask.update({
                     where: { id: task.id },
                     data: { status: 'completed' }
                 });
                 return false;
            }
            return true;
        });

        if (!shouldContinue) {
            await io.logger.info("Task stopped or finished.");
            isRunning = false;
            break;
        }

        // 2. Web Search
        const searchResults = await io.runTask(`search-${iterationCount}`, async () => {
             const apiKey = process.env.TAVILY_API_KEY;
             if (!apiKey) throw new Error("Missing Tavily API Key");

             const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey, query: currentQuery, max_results: 5 }),
              });
              if (!response.ok) throw new Error(`Search failed: ${response.status}`);
              const data = await response.json();
              return data.results;
        });

        if (searchResults.length > 0) {
             // 3. Extract Data using LLM
            const extraction = await io.runTask(`extract-${iterationCount}`, async () => {
                const smartModel = google('gemini-1.5-pro-latest');
                const result = await generateObject({
                    model: smartModel,
                    schema: z.object({
                        journalists: z.array(z.object({
                            name: z.string(),
                            email: z.string().email(),
                            outlet: z.string().optional(),
                            role: z.string().optional(),
                        })),
                        nextQuery: z.string().describe("Suggest the next query to find more journalists in a different region or city."),
                    }),
                    prompt: `Extract journalist information from the following search results: ${JSON.stringify(searchResults)}. Also suggest a next search query to continue coverage of Polish cities/regions. Current query was: ${currentQuery}`
                });
                return result.object;
            });

            const { journalists, nextQuery } = extraction;

            // 4. Upsert into DB
            await io.runTask(`upsert-${iterationCount}`, async () => {
                 for (const journalist of journalists) {
                    try {
                        await prisma.journalist.upsert({
                            where: { email: journalist.email },
                            update: {
                                name: journalist.name,
                                outlet: journalist.outlet,
                                role: journalist.role,
                            },
                            create: {
                                name: journalist.name,
                                email: journalist.email,
                                outlet: journalist.outlet,
                                role: journalist.role,
                            }
                        });
                    } catch (e) {
                         // Ignore duplicate errors
                         console.warn(`Failed to upsert ${journalist.email}`);
                    }
                }
            });

            // 5. Update State
            await io.runTask(`save-state-${iterationCount}`, async () => {
                 await prisma.proceduralMemory.upsert({
                    where: { toolId: memoryKey },
                    update: {
                        steps: nextQuery,
                        description: `Last processed query: ${searchResults[0]?.title || 'search result'}`
                    },
                    create: {
                        toolId: memoryKey,
                        steps: nextQuery,
                        description: "Journalist Collector Progress"
                    }
                });
            });

            currentQuery = nextQuery;
            await io.logger.info(`Next query: ${nextQuery}`);

        } else {
             // Blind retry strategy
             currentQuery = "redakcja kontakt email";
             await io.logger.warn("No results, trying generic query.");
        }

        // Wait a bit before next iteration
        await io.wait("wait-1-minute", 60);
    }

    return { status: "finished" };
  },
});
