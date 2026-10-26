import { describeCelebration, expect, expectAccessible, test } from './support';

test.describe('home page', () => {
  test('arrives already drawn, then reads a description as you type', async ({ page }) => {
    const response = await page.goto('/');
    // The first screen is in the HTML itself, before any script runs: the headline and the
    // first photograph, which the browser fetches first.
    const html = (await response?.text()) ?? '';
    expect(html).toContain('One planner for every');
    expect(html).toMatch(/<img[^>]+wedding-720-[\w-]+\.webp[^>]+fetchpriority="high"/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('One planner for every');
    const photo = page.locator('.hero-slide img').first();
    await expect
      .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    await expect(page.locator('html')).toHaveAttribute('data-mood', 'neutral');
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

  test('follows the device’s light or dark setting until a theme is chosen', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  });

  test('remembers the chosen theme and language', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to the night theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('उत्सव');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
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
