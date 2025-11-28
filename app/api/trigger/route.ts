import { createAppRoute } from "@trigger.dev/nextjs";
import { client } from "@/trigger/client";
import "@/trigger/journalistCollector"; // Import the job file to register it

// Destructure the route handler
const { POST: postHandler } = createAppRoute(client);

// Export the POST handler cast to 'any' to solve the type mismatch problem in Next.js 14
export const POST = postHandler as any;

// Hardcode configuration values to ensure Next.js static analysis works correctly
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "auto";
