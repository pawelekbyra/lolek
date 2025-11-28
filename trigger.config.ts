import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_dummy_123",
  runtime: "node",
  logLevel: "log",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 8200,
      factor: 2,
      randomize: true,
    },
  },
});
