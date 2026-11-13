import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { state, transaction } from '../../server/store.js';
import { initializeUsers, login, currentUser, logout, requireAdmin, sessionDuration } from '../../server/auth.js';
import { getCart, setQuantity } from '../../server/cart.js';
import { quote, placeOrder } from '../../server/checkout.js';
import { saveProduct, deleteProduct } from '../../server/admin.js';
import { searchProducts } from '../../server/products.js';

const seed = structuredClone(state);
let customer, admin;
const delivery = { name: 'Test Shopper', email: 'SHOPPER@example.com', address: '12 Test Street', city: 'Test City', postalCode: 'AB' };
const fields = { name: 'Test product', description: 'A test description', category: 'Other', price: 100, stock: 10, icon: '*', color: '#abcdef' };
const orderInput = overrides => ({ idempotencyKey: randomUUID(), delivery: { ...delivery }, ...overrides });
const rejects = (fn, status, message) => {
  try { fn(); throw new Error('Expected rejection'); }
  catch (error) { expect(error.status).toBe(status); if (message) expect(error.message).toContain(message); }
};
beforeEach(async () => {
  Object.assign(state, structuredClone(seed), { users: [], carts: {}, orders: [] });
  await initializeUsers();
  customer = state.users.find(user => user.role === 'customer');
  admin = state.users.find(user => user.role === 'admin');
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const add = (quantity = 1) => setQuantity(customer, { productId: 'canvas-tote', quantity });

test('REQ-001 REQ-002: normalized account login, protected public fields and uniform credential errors', async () => {
  const result = await login({ email: '  SHOPPER@EXAMPLE.COM  ', password: process.env.SHOP_USER_PASSWORD });
  expect(result.user).toEqual({ id: customer.id, email: customer.email, role: 'customer' });
  expect(result.token).toMatch(/^[a-f0-9]{64}$/);
  for (const email of ['missing@example.com', customer.email]) {
    await expect(login({ email, password: 'incorrect-password' })).rejects.toMatchObject({ status: 401, message: 'Email or password is incorrect.' });
  }
  for (const input of [null, [], {}, { email: 'bad', password: '1234567890' }, { email: customer.email, password: 'x'.repeat(9) }, { email: customer.email, password: 'x'.repeat(129) }]) {
    await expect(login(input)).rejects.toMatchObject({ status: 400 });
  }
  await initializeUsers();
  expect(state.users).toHaveLength(2);
});

test('REQ-004: sessions expire at eight hours, logout revokes, missing users and malformed tokens fail', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const result = await login({ email: customer.email, password: process.env.SHOP_USER_PASSWORD });
  expect(currentUser(result.token)).toEqual(result.user);
  for (const token of [undefined, '', 'invalid', 'a'.repeat(64)]) expect(currentUser(token)).toBeNull();
  vi.setSystemTime(Date.now() + sessionDuration - 1);
  expect(currentUser(result.token)).toEqual(result.user);
  vi.setSystemTime(Date.now() + 1);
  expect(currentUser(result.token)).toBeNull();
  const next = await login({ email: customer.email, password: process.env.SHOP_USER_PASSWORD });
  state.users = [];
  expect(currentUser(next.token)).toBeNull();
  logout(next.token); logout();
});

test('REQ-004: login sweeps expired sessions and explicit logout invalidates access', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const first = await login({ email: customer.email, password: process.env.SHOP_USER_PASSWORD });
  vi.setSystemTime(Date.now() + sessionDuration);
  const second = await login({ email: customer.email, password: process.env.SHOP_USER_PASSWORD });
  expect(currentUser(first.token)).toBeNull();
  logout(second.token);
  expect(currentUser(second.token)).toBeNull();
});

test('REQ-005 REQ-020: private actions and all admin mutations enforce identity and role', () => {
  for (const user of [null, customer]) {
    for (const operation of [
      () => saveProduct(user, null, fields),
      () => saveProduct(user, 'canvas-tote', fields),
      () => deleteProduct(user, 'canvas-tote')
    ]) rejects(operation, user ? 403 : 401);
  }
  requireAdmin(admin);
  for (const operation of [() => getCart(null), () => setQuantity(null, {}), () => quote(null, {}), () => placeOrder(null, {})]) rejects(operation, 401);
  add();
  expect(getCart(admin).items).toEqual([]);
  setQuantity(admin, { productId: 'stone-mug', quantity: 2, userId: customer.id });
  expect(getCart(customer).items.map(line => line.productId)).toEqual(['canvas-tote']);
});

test('REQ-006 REQ-007 REQ-008: public fields, literal case-insensitive search and exact category combinations', () => {
  expect(searchProducts()).toHaveLength(6);
  expect(searchProducts()[0]).toMatchObject({ name: expect.any(String), description: expect.any(String), category: expect.any(String), price: expect.any(Number), icon: expect.any(String) });
  expect(searchProducts(' MUG ').map(p => p.id)).toEqual(['stone-mug']);
  expect(searchProducts('unhurried')).toHaveLength(1);
  expect(searchProducts('carry')).toHaveLength(1);
  expect(searchProducts('mug', 'Carry')).toHaveLength(0);
  expect(searchProducts('', 'Home')).toHaveLength(3);
  expect(searchProducts('', 'home')).toHaveLength(0);
  expect(searchProducts('.*')).toHaveLength(0);
  expect(searchProducts('x'.repeat(100))).toEqual([]);
  expect(searchProducts('', 'x'.repeat(40))).toEqual([]);
  rejects(() => searchProducts('x'.repeat(101)), 400);
  rejects(() => searchProducts('', 'x'.repeat(41)), 400);
});

test('REQ-009 REQ-011: bag uses current prices, zero removes and adding does not reserve stock', () => {
  add(2);
  expect(state.products[0].stock).toBe(30);
  state.products[0].price = 101;
  expect(getCart(customer).subtotal).toBe(202);
  add(0);
  expect(getCart(customer)).toEqual({ items: [], subtotal: 0 });
  add(0);
  expect(getCart(customer).items).toEqual([]);
  state.products[0].stock = 1;
  rejects(() => add(2), 409);
  expect(getCart(customer).items).toEqual([]);
});

test('REQ-010: 1 and 10 accepted; nonintegers and out-of-range quantities rejected atomically', () => {
  add(1); add(10);
  const before = structuredClone(state);
  for (const quantity of [-1, 11, 1.5, '2', null]) {
    rejects(() => add(quantity), 400);
    expect(state).toEqual(before);
  }
});

test('REQ-010: 30 distinct products allowed, 31st rejected; updating an existing line remains allowed', () => {
  state.products = Array.from({ length: 31 }, (_, i) => ({ ...fields, id: `product-${i}` }));
  for (let i = 0; i < 30; i++) setQuantity(customer, { productId: `product-${i}`, quantity: 1 });
  rejects(() => setQuantity(customer, { productId: 'product-30', quantity: 1 }), 400);
  setQuantity(customer, { productId: 'product-0', quantity: 10 });
  expect(getCart(customer).items).toHaveLength(30);
  expect(getCart(customer).items.find(line => line.productId === 'product-0').quantity).toBe(10);
});

test('REQ-012: deleted and insufficient-stock lines block checkout and can be removed', () => {
  add();
  state.products[0].stock = 0;
  rejects(() => quote(customer, {}), 409);
  deleteProduct(admin, 'canvas-tote');
  expect(getCart(customer)).toMatchObject({ items: [{ product: null }], subtotal: 0 });
  rejects(() => placeOrder(customer, orderInput()), 409);
  add(0);
  expect(getCart(customer).items).toEqual([]);
});

test('REQ-013 REQ-014: discount rounding, normalization and inclusive shipping threshold', () => {
  add();
  for (const [price, code, discount, shipping, total] of [
    [7499, '', 0, 500, 7999], [7500, '', 0, 0, 7500], [7501, '', 0, 0, 7501],
    [8333, ' welcome10 ', 833, 0, 7500], [8332, 'WELCOME10', 833, 500, 7999],
    [105, 'Welcome10', 11, 500, 594]
  ]) {
    state.products[0].price = price;
    expect(quote(customer, { discountCode: code })).toMatchObject({ discount, shipping, total });
  }
  expect(quote(customer, {})).toMatchObject({ discountCode: '', discount: 0 });
  for (const code of ['SAVE20', 'x'.repeat(30), 'x'.repeat(31), 1]) rejects(() => quote(customer, { discountCode: code }), 400);
});

test('REQ-015: empty or corrupted bag is rejected and client totals cannot override server calculations', () => {
  rejects(() => quote(customer, {}), 400, 'empty');
  rejects(() => quote(customer, null), 400);
  add();
  expect(quote(customer, { subtotal: 1, total: 1, shipping: 0 })).toMatchObject({ subtotal: 2800, total: 3300 });
  state.carts[customer.id][0].quantity = 11;
  rejects(() => quote(customer, {}), 400);
});

test('REQ-016: delivery inclusive bounds, trimmed text and normalized email are persisted', () => {
  for (const upper of [false, true]) {
    add();
    const details = { name: 'n'.repeat(upper ? 100 : 2), address: 'a'.repeat(upper ? 200 : 5), city: 'c'.repeat(upper ? 80 : 2), postalCode: 'p'.repeat(upper ? 20 : 2), email: ' SHOPPER@EXAMPLE.COM ' };
    const result = placeOrder(customer, orderInput({ delivery: Object.fromEntries(Object.entries(details).map(([key, value]) => [key, ` ${value} `])) }));
    expect(result.delivery).toEqual({ ...details, email: 'shopper@example.com' });
  }
});

test('REQ-016 REQ-024: invalid delivery is rejected server-side without mutation', () => {
  add();
  for (const [field, min, max] of [['name', 2, 100], ['address', 5, 200], ['city', 2, 80], ['postalCode', 2, 20]]) {
    for (const value of [' ', 'a'.repeat(min - 1), 'a'.repeat(max + 1), 'valid\u0000text', null]) {
      const before = structuredClone(state);
      rejects(() => placeOrder(customer, orderInput({ delivery: { ...delivery, [field]: value } })), 400);
      expect(state).toEqual(before);
    }
  }
  for (const value of ['bad', 'a'.repeat(255) + '@example.com', null]) rejects(() => placeOrder(customer, orderInput({ delivery: { ...delivery, email: value } })), 400);
  for (const input of [null, {}, orderInput({ idempotencyKey: 'x'.repeat(36) }), orderInput({ delivery: null })]) rejects(() => placeOrder(customer, input), 400);
});

test('REQ-017 REQ-018 REQ-023: order snapshot, retry idempotency and independent checkouts', () => {
  add(2);
  const input = orderInput({ discountCode: 'WELCOME10', total: 1 });
  const order = placeOrder(customer, input);
  expect(order).toMatchObject({ userId: customer.id, delivery: { ...delivery, email: 'shopper@example.com' }, subtotal: 5600, discount: 560, total: 5540 });
  expect(order.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(Number.isNaN(Date.parse(order.createdAt))).toBe(false);
  expect(state.products[0].stock).toBe(28);
  expect(getCart(customer).items).toEqual([]);
  expect(placeOrder(customer, input)).toEqual(order);
  expect(state.orders).toHaveLength(1);
  expect(state.products[0].stock).toBe(28);
  add();
  placeOrder(customer, orderInput({ discountCode: 'WELCOME10' }));
  expect(state.orders).toHaveLength(2);
  expect(state.products[0].stock).toBe(27);
  const snapshot = structuredClone(state.orders);
  saveProduct(admin, 'canvas-tote', { ...fields, name: 'Changed product' });
  deleteProduct(admin, 'canvas-tote');
  expect(state.orders).toEqual(snapshot);
});

test('REQ-017 REQ-025: failed disk save rolls back stock, cart and orders; successful data is persisted', () => {
  add();
  expect(JSON.parse(fs.readFileSync(process.env.SHOP_DATA_FILE, 'utf8')).carts[customer.id]).toHaveLength(1);
  const before = structuredClone(state);
  vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('disk unavailable'); });
  expect(() => placeOrder(customer, orderInput())).toThrow('disk unavailable');
  expect(state).toEqual(before);
  vi.restoreAllMocks();
  placeOrder(customer, orderInput());
  const disk = JSON.parse(fs.readFileSync(process.env.SHOP_DATA_FILE, 'utf8'));
  expect(disk).toEqual(state);
  expect(disk.users.every(user => !('password' in user) && user.hash.length === 128 && user.salt.length === 32)).toBe(true);
});

test('REQ-021 REQ-022 REQ-023: admin CRUD, limits and missing records', () => {
  const created = saveProduct(admin, null, fields);
  expect(created).toMatchObject(fields);
  expect(saveProduct(admin, created.id, { ...fields, price: 1000000, stock: 10000 })).toMatchObject({ id: created.id, price: 1000000, stock: 10000 });
  for (const input of [
    { price: 0 }, { price: 1000001 }, { price: 1.1 }, { stock: -1 }, { stock: 10001 }, { stock: 1.1 },
    { color: '#zzzzzz' }, { color: 'abc' }, { name: 'x' }, { description: 'tiny' }, { category: 'x' }, { icon: '' },
    { name: 'x'.repeat(101) }, { description: 'x'.repeat(501) }, { category: 'x'.repeat(41) }, { icon: 'x'.repeat(9) }
  ]) rejects(() => saveProduct(admin, null, { ...fields, ...input }), 400);
  expect(saveProduct(admin, created.id, { ...fields, name: 'ab', description: 'abcde', category: 'ab', icon: '*', price: 1, stock: 0 })).toMatchObject({ price: 1, stock: 0 });
  expect(saveProduct(admin, created.id, { ...fields, name: 'x'.repeat(100), description: 'x'.repeat(500), category: 'x'.repeat(40), icon: 'x'.repeat(8) })).toBeTruthy();
  state.products = Array.from({ length: 499 }, (_, i) => ({ ...fields, id: `p-${i}` }));
  const last = saveProduct(admin, null, fields);
  expect(state.products).toHaveLength(500);
  rejects(() => saveProduct(admin, null, fields), 400, 'Catalog limit');
  saveProduct(admin, last.id, { ...fields, stock: 0 });
  expect(deleteProduct(admin, last.id)).toEqual({ message: 'Product deleted.' });
  rejects(() => saveProduct(admin, last.id, fields), 404);
  rejects(() => deleteProduct(admin, last.id), 404);
});

test('REQ-025: saved business records reload while sessions reset in a fresh module instance', async () => {
  add();
  const session = await login({ email: customer.email, password: process.env.SHOP_USER_PASSWORD });
  const saved = structuredClone(state);
  vi.resetModules();
  const freshStore = await import('../../server/store.js');
  const freshAuth = await import('../../server/auth.js');
  expect(freshStore.state).toEqual(saved);
  expect(freshAuth.currentUser(session.token)).toBeNull();
  logout(session.token);
});

test('REQ-025: accepts 10000 active sessions and rejects one more without evicting an active session', async () => {
  vi.resetModules();
  const crypto = await import('node:crypto');
  vi.doMock('node:crypto', () => ({
    ...crypto,
    scrypt: (_value, _salt, _length, callback) => callback(null, Buffer.alloc(64, 1))
  }));
  const freshStore = await import('../../server/store.js');
  const freshAuth = await import('../../server/auth.js');
  freshStore.state.users = structuredClone(state.users);
  const secret = 'capacity-fixture-password';
  freshStore.state.users[0].hash = Buffer.alloc(64, 1).toString('hex');
  try {
    let first;
    for (let i = 0; i < 10000; i++) {
      const result = await freshAuth.login({ email: freshStore.state.users[0].email, password: secret });
      first ||= result;
    }
    await expect(freshAuth.login({ email: freshStore.state.users[0].email, password: secret })).rejects.toMatchObject({ status: 503 });
    expect(freshAuth.currentUser(first.token)).toEqual(first.user);
  } finally {
    vi.doUnmock('node:crypto');
  }
});
