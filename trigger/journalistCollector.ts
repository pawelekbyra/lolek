import { task, wait } from "@trigger.dev/sdk/v3";
import { PrismaClient } from "@prisma/client";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";

const prisma = new PrismaClient();

// Define schema for structured output from LLM
const JournalistSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  outlet: z.string().optional(),
  role: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const SearchResultsSchema = z.object({
  journalists: z.array(JournalistSchema),
  nextRegionOrCity: z.string().optional().describe("The next region or city to search for, based on the current one."),
});

type SearchResults = z.infer<typeof SearchResultsSchema>;

export const journalistCollector = task({
  id: "journalist-collector",
  run: async (payload: { userId: string, initialRegion?: string }) => {
    const { userId, initialRegion } = payload;

    // Safety break: 10 hours * 60 minutes = 600 iterations (if 1 min wait)
    const MAX_ITERATIONS = 600;
    let iteration = 0;

    console.log(`Starting Journalist Collector for user ${userId}`);

    // --- State Resumption ---
    // 1. Get the task record first
    const taskRecord = await prisma.longTermTask.findFirst({
        where: {
          userId: userId,
          description: "JournalistCollector",
          // We don't filter by status here yet, as we might be restarting a stopped task
        },
      });

    if (!taskRecord) {
        console.error("Task record not found. Cannot proceed.");
        return;
    }

    // 2. Determine starting region: Payload > Saved State > Default
    let currentRegion = initialRegion;

    if (!currentRegion) {
        // Try to fetch last state from the latest DecisionLog for this task
        const lastLog = await prisma.decisionLog.findFirst({
            where: {
                taskId: taskRecord.id,
            },
            orderBy: {
                timestamp: 'desc',
            },
        });

        if (lastLog) {
            try {
                const decision = JSON.parse(lastLog.decision);
                if (decision.nextRegion) {
                    currentRegion = decision.nextRegion;
                    console.log(`Resuming from saved state (DecisionLog): ${currentRegion}`);
                }
            } catch (e) {
                // Ignore parsing errors, might be a text log
            }
        }
    }

    if (!currentRegion) {
        currentRegion = "Dolny Śląsk - Wrocław";
        console.log(`No saved state found. Starting fresh: ${currentRegion}`);
    }


    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // 3. Check Task Status (Live check)
      const currentTaskStatus = await prisma.longTermTask.findUnique({
        where: { id: taskRecord.id },
      });

      if (!currentTaskStatus || currentTaskStatus.status !== "in_progress") {
        console.log("Task stopped or not in_progress. Stopping execution.");
        break;
      }

      console.log(`Iteration ${iteration}: Searching for journalists in ${currentRegion}`);

      // 4. Web Search
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error("TAVILY_API_KEY is not set");
      }

      const query = `dziennikarze email, ${currentRegion}`;
      let searchResults = "";

      try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey, query: query, max_results: 5 }),
        });

        if (response.ok) {
            const data = await response.json();
            searchResults = JSON.stringify(data.results);
        } else {
            console.error(`Tavily API error: ${response.status}`);
            await wait.for({ seconds: 10 });
            continue;
        }
      } catch (e) {
        console.error("Search failed", e);
        await wait.for({ seconds: 10 });
        continue;
      }

      // 5. Extract Data using LLM
      const model = google('gemini-1.5-pro'); // Corrected model name

      try {
        const { text } = await generateText({
            model: model as any,
            prompt: `
              Analyze the following search results for query "${query}".
              Extract a list of journalists with their emails, outlets, and roles.
              Ensure emails are valid.
              Also, suggest the NEXT logical city or region in Poland to search for after "${currentRegion}" to continue a nationwide sweep.

              Return a raw JSON object (no markdown formatting) with this structure:
              {
                "journalists": [
                  { "name": "...", "email": "...", "outlet": "...", "role": "...", "notes": "...", "tags": ["..."] }
                ],
                "nextRegionOrCity": "..."
              }

              Search Results:
              ${searchResults}
            `,
        });

        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const rawObject = JSON.parse(jsonString);
        const object = SearchResultsSchema.parse(rawObject);

        // 6. Upsert Data
        for (const journalist of object.journalists) {
            if (journalist.email) {
                try {
                    await prisma.journalist.upsert({
                        where: { email: journalist.email },
                        update: {
                            name: journalist.name,
                            outlet: journalist.outlet,
                            role: journalist.role,
                            updatedAt: new Date(),
                        },
                        create: {
                            name: journalist.name,
                            email: journalist.email,
                            outlet: journalist.outlet,
                            role: journalist.role,
                            notes: journalist.notes,
                            tags: journalist.tags || [currentRegion!],
                        }
                    });
                    console.log(`Upserted journalist: ${journalist.email}`);
                } catch (dbError) {
                    console.error(`Failed to upsert journalist ${journalist.email}:`, dbError);
                }
            }
        }

        // 7. Update Progress & Save State
        if (object.nextRegionOrCity) {
            currentRegion = object.nextRegionOrCity;

            // Save state to ProceduralMemory
            // We need a 'toolId' for ProceduralMemory. We'll use a dummy one or find one.
            // Since we don't have a dedicated tool record for this trigger task in the 'Tool' table,
            // we will try to upsert by unique constraint if possible, but ProceduralMemory has @@unique([toolId]).
            // If we can't easily use ProceduralMemory without a Tool, let's store it in DecisionLog or assume we can reuse a tool ID.
            // ALTERNATIVE: Store in LongTermTask.description? No, that's the type.
            // Let's create a specialized entry in ProceduralMemory. We need a valid toolId.
            // Let's check if 'manage_long_term_task' tool exists in Tool table. If not, we can't link it.
            // Safe fallback: Log to DecisionLog, and relying on finding the LAST DecisionLog for state is safer than failing foreign keys.

            // However, the review asked for "queryable field".
            // Let's try to update the 'LongTermTask' record itself if we can add a field or abuse 'description'? No.
            // Let's stick to DecisionLog but reading the *latest* one for resumption.

            await prisma.decisionLog.create({
                data: {
                    userId: userId,
                    taskId: taskRecord.id,
                    decision: JSON.stringify({ action: "progress_update", nextRegion: currentRegion }),
                }
            });

            // ALSO: Update the in-memory state variable for the loop.

            // For true resumption after restart, we need to read this back.
            // I updated the step 2 above to read from ProceduralMemory.
            // Let's try to upsert a ProceduralMemory if we can find a Tool ID.
            // Since I cannot easily find a Tool ID without querying, and I can't rely on one existing...
            // I will modify step 2 to read from the latest DecisionLog instead.
        }

      } catch (llmError) {
          console.error("LLM extraction failed", llmError);
      }

      // Wait before next iteration
      await wait.for({ seconds: 60 });
    }
  },
});
