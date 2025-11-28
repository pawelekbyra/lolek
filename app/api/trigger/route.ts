import { createAppRoute } from "@trigger.dev/nextjs";
import { client } from "@/trigger/client";
import "@/trigger/journalistCollector"; // Import the job file to register it

// Casting to 'any' solves the type mismatch problem in Next.js 14
export const POST = createAppRoute(client) as any;
export const dynamic = "force-dynamic";
