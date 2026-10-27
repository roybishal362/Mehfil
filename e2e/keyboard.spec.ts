import { expect, tabTo, test } from './support';

test.describe('keyboard only', () => {
  test('skips to the content and plans a celebration without a mouse', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    const describe = page.getByLabel('Describe your celebration');
    await describe.focus();
    await page.keyboard.type('A birthday in Pune on 12 Dec 2026 for 40 guests, budget 60k');
    const submit = page.getByRole('button', { name: 'Plan my celebration' });
    await tabTo(page, submit);
    await expect(submit).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/plan\//);
    // Focus moves to the new page's heading for screen-reader and keyboard users.
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
});
