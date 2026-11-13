import { test as base, expect } from '@playwright/test';
import MCR from 'monocart-coverage-reports';
import { browserCoverage } from '../../utils/browser-coverage.js';

export const test = base.extend({
  coverage: [async ({ page }, use) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    try {
      await use();
    } finally {
      const entries = await page.coverage.stopJSCoverage();
      await MCR(browserCoverage).add(entries);
    }
  }, { auto: true }]
});
export { expect };

export async function signIn(page) {
  await page.getByRole('button', { name: 'Sign in ↗' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill('shopper@example.com');
  await dialog.getByLabel('Password', { exact: true }).fill('browser-shopper-password');
  await dialog.getByRole('button', { name: 'Sign in →', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}
