import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import MCR from 'monocart-coverage-reports';
import { browserCoverage } from './browser-coverage.js';

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' }
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

rmSync('coverage/browser', { recursive: true, force: true });
const buildStatus = run('node_modules/vite/bin/vite.js', ['build', '--sourcemap', '--minify', 'false']);
if (buildStatus) process.exit(buildStatus);

const status = run('node_modules/@playwright/test/cli.js', ['test', ...process.argv.slice(2)]);
const report = await MCR(browserCoverage).generate();
if (!report) throw new Error('No browser coverage was collected.');
process.exitCode = status;
