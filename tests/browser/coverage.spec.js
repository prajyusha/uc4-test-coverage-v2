import { test, expect, signIn } from './fixtures.js';

test('REQ-008 REQ-024: combined category search, empty feedback and clearing filters', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Carry', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search products' }).fill('mug');
  await expect(page.getByText('No good things found.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.product-card')).toHaveCount(6);
});

test('REQ-009 REQ-013 REQ-016 REQ-019 REQ-024: retained bag, discount, server delivery rejection and demo confirmation', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  const card = page.locator('.product-card').filter({ has: page.getByRole('heading', { name: 'Everyday canvas tote', exact: true }) });
  await card.getByRole('button', { name: /Add to bag/ }).click();
  await expect(page.getByRole('button', { name: 'Bag 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page);
  await page.getByRole('button', { name: 'Bag 1', exact: true }).click();
  await page.getByLabel('Discount code', { exact: true }).fill(' welcome10 ');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.summary .total')).toContainText('$30.20');
  await page.getByRole('button', { name: 'Continue to checkout →' }).click();
  const form = page.locator('.delivery-form');
  await expect(form).toContainText('No payment is collected and no goods will be shipped.');
  await form.getByLabel('Full name', { exact: true }).fill('  ');
  await form.getByLabel('Street address', { exact: true }).fill('12 Test Street');
  await form.getByLabel('City', { exact: true }).fill('Test City');
  await form.getByLabel('Postal code', { exact: true }).fill('AB');
  await form.getByRole('button', { name: /Place demo order/ }).click();
  await expect(page.getByRole('alert')).toContainText('Full name');
  await form.getByLabel('Full name', { exact: true }).fill('Test Shopper');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/checkout') && response.status() === 201);
  await form.getByRole('button', { name: /Place demo order/ }).click();
  const order = await (await responsePromise).json();
  await expect(page.getByRole('heading', { name: 'Good things are on the way.' })).toBeVisible();
  await expect(page.locator('.success')).toContainText(order.id.slice(0, 8));
  await expect(page.locator('.success')).toContainText('$30.20');
  await expect(page.locator('.success')).toContainText('No payment was collected.');
  await expect(page.getByRole('button', { name: 'Bag 0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the good things →' }).click();
  await expect(page.locator('.product-card')).toHaveCount(6);
});

test('REQ-006 REQ-020 REQ-021 REQ-023: admin-only management, out-of-stock product and confirmed deletion', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Manage products', exact: true })).toHaveCount(0);
  const denied = await page.request.post('/api/admin/products', { headers: { 'X-Shop-Request': '1' }, data: {} });
  expect(denied.status()).toBe(403);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in ↗' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await dialog.getByLabel('Password', { exact: true }).fill('browser-admin-password');
  await dialog.getByRole('button', { name: 'Sign in →', exact: true }).click();
  await page.getByRole('button', { name: 'Manage products', exact: true }).click();
  await page.getByRole('button', { name: /New product/ }).click();
  const form = page.locator('.admin-form');
  for (const [label, value] of [['Name', 'Coverage specimen'], ['Category', 'Other'], ['Price (USD)', '1.25'], ['Stock', '0'], ['Symbol', '*'], ['Description', 'Browser test specimen']]) {
    await form.getByLabel(label, { exact: true }).fill(value);
  }
  await form.getByRole('button', { name: 'Save product', exact: true }).click();
  const row = page.locator('.admin-row').filter({ has: page.getByRole('heading', { name: 'Coverage specimen', exact: true }) });
  await expect(row).toContainText('$1.25');
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await form.getByLabel('Price (USD)', { exact: true }).fill('2.50');
  await form.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(row).toContainText('$2.50');
  await page.getByRole('button', { name: 'The shop', exact: true }).click();
  const card = page.locator('.product-card').filter({ has: page.getByRole('heading', { name: 'Coverage specimen', exact: true }) });
  await expect(card.getByRole('button', { name: /Out of stock/ })).toBeDisabled();
  await expect(page.locator('.categories')).not.toContainText('Other');
  await page.getByRole('button', { name: 'Manage products', exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'The shop', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coverage specimen', exact: true })).toHaveCount(0);
});
