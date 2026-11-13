import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/server/**/*.test.js'],
    setupFiles: ['tests/server/setup.js'],
    fileParallelism: false,
    maxWorkers: 1,
    coverage: {
      provider: 'istanbul',
      include: ['server/**/*.js'],
      reporter: ['text', 'json', 'json-summary', 'lcovonly', 'html'],
      reportsDirectory: 'coverage/server'
    }
  }
});
