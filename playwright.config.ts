import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Uses a fixed timezone so seeded "today" data is deterministic.
 * Set PW_CHANNEL=chromium to use Playwright's bundled browser instead of system Chrome.
 */
const channel = process.env.PW_CHANNEL ?? "chrome";
const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    timezoneId: "Asia/Colombo",
    locale: "en-LK",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: channel === "chromium" ? undefined : channel, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
