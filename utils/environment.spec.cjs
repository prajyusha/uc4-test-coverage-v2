const { test, expect } = require('@playwright/test');

test('Node and Chromium environment smoke test', async ({ page }) => {
  expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(22);
  await page.setContent(`
    <title>Environment smoke test</title>
    <button onclick="document.querySelector('output').textContent='ready'">Check</button>
    <output>waiting</output>
  `);
  await expect(page).toHaveTitle('Environment smoke test');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('output')).toHaveText('ready');
});
