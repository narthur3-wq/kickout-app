import { defineConfig } from '@playwright/test';
import { readFileSync } from 'fs';

// Load .env.e2e into the test process so smoke credentials are available
try {
  for (const line of readFileSync('.env.e2e', 'utf8').split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
} catch { /* .env.e2e is optional */ }

const commonUse = {
  baseURL: 'http://127.0.0.1:4173',
  headless: true,
  viewport: { width: 1400, height: 1600 },
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: commonUse,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'webkit-smoke',
      use: {
        browserName: 'webkit',
      },
      testMatch: ['**/navigation.spec.js', '**/capture-flow.spec.js', '**/possession-analysis.spec.js'],
    },
  ],
  webServer: {
    command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
