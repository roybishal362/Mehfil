import { describeCelebration, expect, expectAccessible, test } from './support';

test.describe('home page', () => {
  test('arrives already drawn, then reads a description as you type', async ({ page }) => {
    const response = await page.goto('/');
    // The festive first screen is in the HTML itself, before any script runs.
    expect(await response?.text()).toContain('Light up every');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Light up every');
    await expectAccessible(page);

    await page
      .getByLabel('Describe your celebration')
      .fill("Aarav's 7th birthday party in Pune on 12 Dec 2026, 40 guests, budget ₹60,000.");
    const understood = page.locator('.understood');
    await expect(understood).toContainText('Birthday');
    await expect(understood).toContainText('Pune');
    await expect(understood).toContainText('40');
  });

  test('asks for a description instead of submitting an empty one', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Plan my celebration' }).click();
    await expect(page.getByText('Tell us a little about your celebration first.')).toBeVisible();
    await expect(page.getByLabel('Describe your celebration')).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  test('remembers the chosen theme and language', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to the day theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Light up every');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
    await expectAccessible(page);

    await page.getByRole('button', { name: 'বাংলা' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expectAccessible(page);
  });

  test('lists saved plans after a reload, and confirms before deleting one', async ({ page }) => {
    await describeCelebration(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Ananya/ })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('button', { name: /^Delete/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Modal dialogs open in the middle of the screen.
    const box = await dialog.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(Math.abs((box?.x ?? 0) * 2 + (box?.width ?? 0) - width)).toBeLessThan(4);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('link', { name: /Ananya/ })).toBeVisible();
  });
});
