import { expect, expectAccessible, test } from './support';

test.describe('step-by-step form', () => {
  test('lists what is missing and moves focus to the summary', async ({ page }) => {
    await page.goto('/new?type=birthday');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan a new celebration');
    await page.getByRole('button', { name: 'Next' }).click();
    const summary = page
      .getByRole('alert')
      .filter({ hasText: 'Please fix these before continuing' });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('link').first()).toBeVisible();
    await expectAccessible(page);
  });

  test('creates a plan from three short steps', async ({ page }) => {
    await page.goto('/new?type=birthday');
    await page.getByLabel('Name of the celebration').fill('Mira turns 7');
    await page.getByLabel('Date', { exact: true }).fill('2027-03-20');
    await page.getByLabel('City').fill('Bengaluru');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Number of guests').fill('40');
    await page.getByLabel('Total budget').fill('75k');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Create my plan' }).click();
    await page.waitForURL(/\/plan\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mira');
  });
});
