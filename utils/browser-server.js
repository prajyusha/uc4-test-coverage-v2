import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const directory = mkdtempSync(path.join(tmpdir(), 'little-goods-browser-'));
const server = spawn(process.execPath, ['server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, SHOP_DATA_FILE: path.join(directory, 'shop.json') }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('error', error => {
  console.error(error);
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = 1;
});
server.on('exit', code => {
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});
