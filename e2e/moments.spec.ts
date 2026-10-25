import type { Page } from '@playwright/test';
import { expect, expectAccessible, test } from './support';

const DIWALI =
  'Diwali dinner for the family in Jaipur on 8 Nov 2026 for 60 guests, budget ₹1.5 lakh.';

async function planDiwali(page: Page) {
  await page.goto('/');
  await page.getByLabel('Describe your celebration').fill(DIWALI);
  await page.getByRole('button', { name: 'Plan my celebration' }).click();
  await page.waitForURL(/\/plan\/[^/]+$/);
}

test.describe('celebration moments, with motion welcome', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a new plan opens with its moment; any key ends it, and it can play again', async ({
    page,
  }) => {
    await planDiwali(page);
    const moment = page.locator('.moment');
    await expect(moment).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-mood', 'diwali');
    await page.keyboard.press('Escape');
    await expect(moment).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Diwali');
    await expectAccessible(page);

    // It plays by itself only the first time.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(moment).toHaveCount(0);

    await page.getByRole('button', { name: 'Celebrate again' }).click();
    await expect(moment).toBeVisible();
    // It ends by itself after a few seconds.
    await expect(moment).toHaveCount(0, { timeout: 8000 });
  });
});

test.describe('celebration moments, with reduced motion', () => {
  test('never play, and offer no replay', async ({ page }) => {
    await planDiwali(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Diwali');
    await page.waitForTimeout(500);
    await expect(page.locator('.moment')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Celebrate again' })).toBeHidden();
  });
});
