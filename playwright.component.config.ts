import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/component",
  workers: 1,
  projects: [{ name: "chromium" }],
  use: {
    baseURL: "http://127.0.0.1:5173",
    ...devices["Desktop Chrome"],
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : existsSync("/Applications/Google Chrome.app")
        ? { channel: "chrome" }
        : {}),
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
