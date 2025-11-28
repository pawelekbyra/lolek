import { TriggerClient } from "@trigger.dev/sdk";

export const client = new TriggerClient({
  id: "lolek-client",
  apiKey: process.env.TRIGGER_SECRET_KEY,
  apiUrl: process.env.TRIGGER_API_URL,
});
