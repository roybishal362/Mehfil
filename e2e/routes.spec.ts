import { expect, expectAccessible, test } from './support';

test.describe('other routes', () => {
  test('an unknown plan explains itself and links home', async ({ page }) => {
    await page.goto('/plan/evt_missing');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that plan');
    await expect(page.getByRole('link', { name: 'Back to your celebrations' })).toBeVisible();
    await expectAccessible(page);
  });

  test('an unknown address shows the not-found page', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  });

  test('a share link says so when this server has no cloud features', async ({ page }) => {
    await page.goto('/s/AbCdEfGhIjKlMnOpQrSt_-');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Shared plans are not available here',
    );
    await expectAccessible(page);
  });

  test('the API answers with security headers', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-request-id']).toBeTruthy();
  });
});
