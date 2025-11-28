import { createAppRoute } from "@trigger.dev/nextjs";
import { client } from "@/trigger/client";
import "@/trigger/journalistCollector"; // Import the job file to register it

export const POST = createAppRoute(client);
export const dynamic = "force-dynamic";
