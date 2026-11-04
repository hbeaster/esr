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
  webServer: process.env.ESR_BASE_URL
    ? undefined
    : [
        {
          command: `${process.env.DOTNET_BIN || "dotnet"} run --project backend/Esr.Api --urls http://127.0.0.1:5080`,
          url: "http://127.0.0.1:5080/health/ready",
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: "npm run dev",
          url: "http://127.0.0.1:5173",
          reuseExistingServer: !process.env.CI,
        },
      ],
});
