import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4178',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node utils/browser-server.js',
    url: 'http://127.0.0.1:4178/api/session',
    reuseExistingServer: false,
    timeout: 30000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    env: {
      NODE_ENV: 'test',
      PORT: '4178',
      SHOP_USER_PASSWORD: 'browser-shopper-password',
      SHOP_ADMIN_PASSWORD: 'browser-admin-password'
    }
  }
});
