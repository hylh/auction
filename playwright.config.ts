import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  projects: [
    {
      // Desktop viewport (Playwright default 1280×720) — runs the full suite.
      name: "chromium",
    },
    {
      // Phone viewport — runs only the responsive checks so the functional
      // flows aren't re-run (and broken) against the mobile bottom-bar layout.
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
      testMatch: /responsive\.spec\.ts/,
    },
  ],
});
