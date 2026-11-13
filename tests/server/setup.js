import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

const directory = mkdtempSync(path.join(tmpdir(), 'little-goods-unit-'));
process.env.SHOP_DATA_FILE = path.join(directory, 'shop.json');
process.env.SHOP_USER_PASSWORD = 'unit-shopper-password';
process.env.SHOP_ADMIN_PASSWORD = 'unit-admin-password';

afterAll(() => rmSync(directory, { recursive: true, force: true }));
