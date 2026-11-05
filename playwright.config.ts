import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.ESR_BASE_URL || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : existsSync("/Applications/Google Chrome.app")
            ? { channel: "chrome" }
            : {}),
      },
    },
  ],
  // Tests never call a real chat model, even with a key in .env or the shell:
  // an empty value here outranks .env for both the API and the dev server.
  webServer: process.env.ESR_BASE_URL
    ? undefined
    : [
        {
          // Mock CRACN API (cracn_openapi.json); the backend resolves JCNs through it.
          command: "node mocks/cracn/server.mjs --port 4010",
          url: "http://127.0.0.1:4010/__mock/health",
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `${process.env.DOTNET_BIN || "dotnet"} run --project backend/Esr.Api --urls http://127.0.0.1:5080`,
          url: "http://127.0.0.1:5080/health/ready",
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
          env: { Chat__ApiKey: "" },
        },
        {
          command: "npm run dev",
          url: "http://127.0.0.1:5173",
          reuseExistingServer: !process.env.CI,
          // Simulated data stays read-only in tests: the suite's shared store
          // must not be replaced by a sandbox load.
          env: { CHAT_API_KEY: "", Chat__ApiKey: "", ESR_SIMULATED_API: "off" },
        },
      ],
});
