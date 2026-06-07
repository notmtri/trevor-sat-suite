import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev -- -p 3100",
        url: "http://127.0.0.1:3100",
        env: {
          NEXT_PUBLIC_DEMO_MODE: "true",
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Pro 11"] },
    },
  ],
});
