import { defineConfig, devices } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = 5173;
const BASE_URL = `http://${HOST}:${PORT}`;
const LOCAL_NO_PROXY = "localhost,127.0.0.1,::1";

process.env.NO_PROXY = appendLocalNoProxy(process.env.NO_PROXY);
process.env.no_proxy = appendLocalNoProxy(process.env.no_proxy);

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
    // Force mock LLM mode so NPC replies are deterministic. dotenv/config
    // (loaded by the server) does not override pre-set process env, so
    // setting LLM_API_KEY="" here keeps mock responders active even when a
    // real key is configured in server/.env for local dev.
    env: { LLM_API_KEY: "", NO_PROXY: LOCAL_NO_PROXY, no_proxy: LOCAL_NO_PROXY }
  }
});

function appendLocalNoProxy(existing: string | undefined): string {
  if (!existing) {
    return LOCAL_NO_PROXY;
  }

  return `${existing},${LOCAL_NO_PROXY}`;
}
