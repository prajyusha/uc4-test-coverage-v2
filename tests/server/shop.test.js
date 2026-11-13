import { scryptSync } from 'node:crypto';
import { beforeAll, expect, test } from 'vitest';
import { login } from '../../server/auth.js';
import { searchProducts } from '../../server/products.js';
import { setQuantity } from '../../server/cart.js';
import { state } from '../../server/store.js';

let customer;

beforeAll(async () => {
  const salt = 'shopper-fixture-salt';
  state.users = [{
    id: 'shopper-fixture',
    email: 'shopper@example.com',
    role: 'customer',
    salt,
    hash: scryptSync(process.env.SHOP_USER_PASSWORD, salt, 64).toString('hex')
  }];
  const result = await login({
    email: 'shopper@example.com',
    password: process.env.SHOP_USER_PASSWORD
  });
  customer = result.user;
});

test('signs in a provisioned shopper', async () => {
  const result = await login({
    email: 'shopper@example.com',
    password: process.env.SHOP_USER_PASSWORD
  });
  expect(result.user.email).toBe('shopper@example.com');
  expect(result.token).toEqual(expect.any(String));
});

test('browses the catalog and searches for a mug', () => {
  expect(searchProducts()).toHaveLength(6);
  const matches = searchProducts('mug');
  expect(matches.map(product => product.id)).toEqual(['stone-mug']);
});

test('adds a product to the shopper bag', () => {
  const bag = setQuantity(customer, { productId: 'canvas-tote', quantity: 1 });
  expect(bag.items).toHaveLength(1);
  expect(bag.items[0]).toMatchObject({
    productId: 'canvas-tote',
    quantity: 1,
    product: { name: 'Everyday canvas tote', price: 2800 }
  });
  expect(bag.subtotal).toBe(2800);
});
