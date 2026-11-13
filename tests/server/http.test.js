import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { afterAll, beforeAll, expect, test } from 'vitest';

let child, base, cookie, directory, dataFile;
const credentials = { email: 'shopper@example.com', password: 'http-shopper-password' };
const headers = { 'X-Shop-Request': '1', 'Content-Type': 'application/json' };
async function stop() {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
}
async function start() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), SHOP_DATA_FILE: dataFile, SHOP_USER_PASSWORD: credentials.password, SHOP_ADMIN_PASSWORD: 'http-admin-password' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  for (let i = 0; i < 200; i++) {
    if (output.includes('Shop listening')) return;
    if (child.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Shop did not start: ${output}`);
}
const post = (url, data, extra = {}) => fetch(base + url, { method: 'POST', headers, body: JSON.stringify(data), ...extra });
async function signIn() {
  const response = await post('/api/login', credentials);
  expect(response.status).toBe(200);
  cookie = response.headers.get('set-cookie').split(';')[0];
}
beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'shop-http-'));
  dataFile = path.join(directory, 'shop.json');
  await start();
}, 15000);
afterAll(async () => { await stop(); rmSync(directory, { recursive: true, force: true }); });

test('REQ-024: rejects cross-site, malformed and oversized requests with safe errors', async () => {
  expect((await post('/api/login', credentials, { headers: { 'Content-Type': 'application/json' } })).status).toBe(403);
  expect((await post('/api/login', credentials, { headers: { ...headers, Origin: 'https://attacker.example' } })).status).toBe(403);
  expect((await post('/api/login', credentials, { headers: { ...headers, Origin: 'not a url' } })).status).toBe(403);
  expect((await post('/api/login', credentials, { headers: { ...headers, 'Content-Type': 'text/plain' } })).status).toBe(415);
  const malformed = await post('/api/login', {}, { body: '{bad' });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toEqual({ error: 'Invalid JSON request.' });
  const oversized = await post('/api/login', { padding: 'x'.repeat(16384) });
  expect(oversized.status).toBe(413);
  expect(await oversized.json()).toEqual({ error: 'Request is too large.' });
  expect((await fetch(base + '/api/missing')).status).toBe(404);
  const session = await fetch(base + '/api/session');
  expect(session.headers.get('cache-control')).toBe('no-store');
  expect(await session.json()).toEqual({ user: null });
});

test('REQ-003 REQ-025: 20 mixed login attempts allowed, 21st denied, restart resets counter', async () => {
  await stop(); await start();
  for (let i = 0; i < 20; i++) {
    const response = await post('/api/login', { ...credentials, password: i % 2 ? credentials.password : 'incorrect-password' });
    expect(response.status).toBe(i % 2 ? 200 : 401);
  }
  const limited = await post('/api/login', credentials);
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  expect(await limited.json()).toEqual({ error: 'Too many login attempts. Please try again later.' });
  await stop(); await start();
  await signIn();
}, 15000);

test('REQ-004 REQ-009 REQ-025: restart revokes sessions while bag and hashed accounts persist', async () => {
  await signIn();
  const update = await fetch(base + '/api/cart', { method: 'PUT', headers: { ...headers, Cookie: cookie }, body: JSON.stringify({ productId: 'canvas-tote', quantity: 2 }) });
  expect(update.status).toBe(200);
  const oldCookie = cookie;
  await stop(); await start();
  const denied = await fetch(base + '/api/cart', { headers: { Cookie: oldCookie } });
  expect(denied.status).toBe(401);
  await signIn();
  const cart = await (await fetch(base + '/api/cart', { headers: { Cookie: cookie } })).json();
  expect(cart).toMatchObject({ subtotal: 5600, items: [{ productId: 'canvas-tote', quantity: 2 }] });
  const disk = readFileSync(dataFile, 'utf8');
  expect(disk).not.toContain(credentials.password);
  const response = await post('/api/logout', {}, { headers: { ...headers, Cookie: cookie } });
  expect(response.status).toBe(200);
  expect((await fetch(base + '/api/cart', { headers: { Cookie: cookie } })).status).toBe(401);
}, 15000);

test('REQ-024: disk failure exposes only generic retry message and leaves bag unchanged', async () => {
  await signIn();
  mkdirSync(`${dataFile}.tmp`);
  try {
    const response = await fetch(base + '/api/cart', { method: 'PUT', headers: { ...headers, Cookie: cookie }, body: JSON.stringify({ productId: 'canvas-tote', quantity: 3 }) });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Something went wrong. Please try again.' });
    const cart = await (await fetch(base + '/api/cart', { headers: { Cookie: cookie } })).json();
    expect(cart.items[0].quantity).toBe(2);
  } finally {
    rmSync(`${dataFile}.tmp`, { recursive: true, force: true });
  }
});
