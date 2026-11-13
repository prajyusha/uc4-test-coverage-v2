import { test, expect, signIn } from './fixtures.js';

test('shopper signs in', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await expect(page.locator('.messages')).toContainText('Welcome back.');
});

test('visitor browses and searches the collection', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Everyday canvas tote' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search products' }).fill('mug');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Slow morning mug' })).toBeVisible();
});

test('shopper adds a tote to the bag', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  const tote = page.locator('.product-card').filter({
    has: page.getByRole('heading', { name: 'Everyday canvas tote', exact: true })
  });
  await tote.getByRole('button', { name: /Add to bag/ }).click();
  await expect(page.getByRole('button', { name: 'Bag 1', exact: true })).toBeVisible();
  await expect(page.locator('.messages')).toContainText('Bag updated. A good choice.');
});
