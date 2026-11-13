import { test, expect, signIn } from './fixtures.js';

const headers = { 'X-Shop-Request': '1' };
const delivery = {
  name: 'Alex Shopper',
  email: 'shopper@example.com',
  address: '12 Oak Street',
  city: 'Portland',
  postalCode: '97201'
};

async function cart(page) {
  const response = await page.request.get('/api/cart');
  expect(response.status()).toBe(200);
  return response.json();
}

async function setQuantity(page, quantity) {
  return page.request.put('/api/cart', {
    headers, data: { productId: 'canvas-tote', quantity }
  });
}

async function openBag(page) {
  await page.getByRole('button', { name: /^Bag \d+$/ }).click();
  await expect(page.getByRole('heading', { name: /^Your bag/ })).toBeVisible();
}

function summaryValue(page, label) {
  return page.locator('.totals p').filter({
    has: page.locator('span').filter({ hasText: new RegExp(`^${label}$`) })
  }).locator('span').last();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  for (const line of (await cart(page)).items) {
    const response = await page.request.put('/api/cart', {
      headers, data: { productId: line.productId, quantity: 0 }
    });
    expect(response.status()).toBe(200);
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  for (const line of (await cart(page)).items) {
    const response = await page.request.put('/api/cart', {
      headers, data: { productId: line.productId, quantity: 0 }
    });
    expect(response.status()).toBe(200);
  }
});

test('TC-083 REQ-010: quantity 10 persists and 11 is rejected without mutation', async ({ page }) => {
  expect((await setQuantity(page, 10)).status()).toBe(200);
  const before = await cart(page);
  expect(before.items).toHaveLength(1);
  expect(before.items[0].quantity).toBe(10);
  expect(before.subtotal).toBe(28000);
  await page.reload();

  const tote = page.locator('.product-card').filter({
    has: page.getByRole('heading', { name: 'Everyday canvas tote', exact: true })
  });
  const update = page.waitForResponse(response =>
    response.url().endsWith('/api/cart') && response.request().method() === 'PUT');
  await tote.getByRole('button', { name: /Add to bag/ }).click();
  expect((await update).status()).toBe(400);
  await expect(page.getByRole('alert')).toContainText('Quantity must be an integer from 0 to 10.');
  expect(await cart(page)).toEqual(before);

  const rejected = await setQuantity(page, 11);
  expect(rejected.status()).toBe(400);
  expect(await rejected.json()).toEqual({ error: 'Quantity must be an integer from 0 to 10.' });
  expect(await cart(page)).toEqual(before);
  await page.reload();
  await openBag(page);
  await expect(page.getByRole('spinbutton', { name: 'Quantity for Everyday canvas tote' })).toHaveValue('10');
  await expect(summaryValue(page, 'Subtotal')).toHaveText('$280.00');
  await expect(page.getByRole('button', { name: 'Bag 10', exact: true })).toBeVisible();
});

test('TC-206 REQ-013: normalized discount, invalid code and clearing use correct totals', async ({ page }) => {
  expect((await setQuantity(page, 1)).status()).toBe(200);
  await page.reload();
  await openBag(page);
  await page.getByLabel('Discount code', { exact: true }).fill('  wElCoMe10  ');
  const quoteResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/checkout/quote') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const response = await quoteResponse;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    discountCode: 'WELCOME10', subtotal: 2800, discount: 280, shipping: 500, total: 3020
  });
  await expect(summaryValue(page, 'Discount')).toHaveText('−$2.80');
  await expect(summaryValue(page, 'Total')).toHaveText('$30.20');
  await page.getByRole('button', { name: 'Continue to checkout →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Delivery details', exact: true })).toBeVisible();
  await expect(summaryValue(page, 'Total')).toHaveText('$30.20');
  await page.getByRole('button', { name: '← Back to bag', exact: true }).click();

  const before = await cart(page);
  await page.getByLabel('Discount code', { exact: true }).fill('SAVE20');
  const invalidQuote = page.waitForResponse(response => response.url().endsWith('/api/checkout/quote'));
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  expect((await invalidQuote).status()).toBe(400);
  await expect(page.getByRole('alert')).toContainText('That discount code is not valid.');
  expect(await cart(page)).toEqual(before);

  await page.getByLabel('Discount code', { exact: true }).fill('');
  const clearedQuote = page.waitForResponse(response => response.url().endsWith('/api/checkout/quote'));
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  expect(await (await clearedQuote).json()).toMatchObject({ discountCode: '', discount: 0, total: 3300 });
  await expect(summaryValue(page, 'Discount')).toHaveText('−$0.00');
  await expect(summaryValue(page, 'Total')).toHaveText('$33.00');
});

test('TC-219 REQ-016: server rejects blank trimmed name and accepts corrected delivery', async ({ page }) => {
  expect((await setQuantity(page, 1)).status()).toBe(200);
  await page.reload();
  await openBag(page);
  await page.getByRole('button', { name: 'Continue to checkout →', exact: true }).click();
  const form = page.locator('.delivery-form');
  await form.getByLabel('Full name', { exact: true }).fill('   ');
  await form.getByLabel('Email', { exact: true }).fill(delivery.email);
  await form.getByLabel('Street address', { exact: true }).fill(delivery.address);
  await form.getByLabel('City', { exact: true }).fill(delivery.city);
  await form.getByLabel('Postal code', { exact: true }).fill(delivery.postalCode);
  const before = await cart(page);
  const productsBefore = await (await page.request.get('/api/products')).json();
  const invalidOrder = page.waitForResponse(response =>
    response.url().endsWith('/api/checkout') && response.request().method() === 'POST');
  await form.getByRole('button', { name: /^Place demo order/ }).click();
  const rejected = await invalidOrder;
  expect(rejected.status()).toBe(400);
  expect(await rejected.json()).toEqual({ error: 'Full name must be 2–100 characters.' });
  await expect(page.getByRole('alert')).toContainText('Full name must be 2–100 characters.');
  await expect(form).toBeVisible();
  expect(await cart(page)).toEqual(before);
  expect(await (await page.request.get('/api/products')).json()).toEqual(productsBefore);

  await form.getByLabel('Full name', { exact: true }).fill(delivery.name);
  const validOrder = page.waitForResponse(response =>
    response.url().endsWith('/api/checkout') && response.request().method() === 'POST');
  await form.getByRole('button', { name: /^Place demo order/ }).click();
  const accepted = await validOrder;
  expect(accepted.status()).toBe(201);
  const order = await accepted.json();
  expect(order).toMatchObject({ delivery, subtotal: 2800, discount: 0, shipping: 500, total: 3300 });
  await expect(page.getByRole('heading', { name: 'Good things are on the way.', exact: true })).toBeVisible();
  await expect(page.locator('.success')).toContainText(order.id.slice(0, 8));
  await expect(page.locator('.success')).toContainText('$33.00');
  await expect(page.getByRole('button', { name: 'Bag 0', exact: true })).toBeVisible();
  expect((await cart(page)).items).toEqual([]);
});
