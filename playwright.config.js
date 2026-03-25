import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1400, height: 1600 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
