import { readFile } from 'node:fs/promises';
import { describeCelebration, expect, expectAccessible, openSection, test } from './support';

test.describe('a plan made from one sentence', () => {
  test.beforeEach(async ({ page }) => {
    await describeCelebration(page);
  });

  test('opens as an invitation with every section tailored', async ({ page }) => {
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toContainText('Ananya');
    await expect(title).toContainText('Rohan');
    await expect(page.getByText('Kolkata').first()).toBeVisible();
    await expect(page.getByText('Standard plan. Ask Gemini to tailor it.')).toHaveCount(0);
    await expectAccessible(page);
  });

  test('rebalances the budget to a new total, keeping every line in step', async ({ page }) => {
    await openSection(page, 'Budget');
    await page.getByLabel('New total').fill('20 lakh');
    await page.getByRole('button', { name: 'Rebalance the lines' }).click();
    await expect(
      page.getByText('The budget was rebalanced to the new total.').first(),
    ).toBeVisible();
    await expect(page.getByText('₹20,00,000').first()).toBeVisible();
    await expectAccessible(page);
  });

  test('ticks off a task and exports the calendar', async ({ page }) => {
    await openSection(page, 'Timeline');
    const label =
      (await page
        .getByRole('checkbox', { name: /^Mark “.+” as done$/ })
        .first()
        .getAttribute('aria-label')) ?? '';
    const task = /^Mark “(.+)” as done$/.exec(label)?.[1] ?? '';
    await page.getByRole('checkbox', { name: `Mark “${task}” as done` }).click();
    // Finished tasks leave the "To do" list and appear under "Done".
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: `Mark “${task}” as not done` })).toBeChecked();

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download calendar' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
    const ics = await readFile(await download.path(), 'utf8');
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('BEGIN:VALARM');
    await expectAccessible(page);
  });

  test('keeps vendor quotes and counts the chosen one in the budget', async ({ page }) => {
    await openSection(page, 'Vendors');
    const form = page.locator('details').filter({ hasText: 'Add a quote' }).first();
    await form.locator('summary').click();
    await form.getByLabel('Vendor name').fill('Roy Caterers');
    await form.getByLabel('Quote').fill('5.5 lakh');
    await form.getByRole('button', { name: 'Add a quote' }).click();
    await expect(page.getByText('Roy Caterers').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Find on Google Maps/ }).first()).toHaveAttribute(
      'href',
      /^https:\/\/www\.google\.com\/maps\/search\//,
    );
    await expectAccessible(page);
  });

  test('asks Gemini for different ideas', async ({ page }) => {
    await openSection(page, 'Ideas');
    await page.getByRole('button', { name: 'More budget-friendly' }).click();
    await expect(page.getByText('New ideas are in.').first()).toBeAttached({ timeout: 15_000 });
    await expectAccessible(page);
  });

  test('applies a Copilot proposal and undoes it', async ({ page }) => {
    await page.getByLabel('Ask Copilot').fill('We now expect 50 more guests');
    await page.getByRole('button', { name: 'Send' }).click();
    const apply = page.getByRole('button', { name: /^Apply \d+ changes?$/ });
    await expect(apply).toBeVisible({ timeout: 15_000 });
    await expectAccessible(page);
    await apply.click();
    await expect(page.getByText(/^Applied \d+ changes?\.$/).first()).toBeVisible();
    await expect(page.getByText('350 guests').first()).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).last().click();
    await expect(page.getByText('300 guests').first()).toBeVisible();
  });

  test('keeps the guest list on this device and writes the invitation', async ({ page }) => {
    await openSection(page, 'Guests');
    await page.locator('#guest-name').fill('Meera Sen');
    await page.getByRole('button', { name: 'Add guest' }).click();
    const party = page.getByLabel('People in Meera Sen’s party');
    await expect(party).toBeVisible();

    await page.getByRole('button', { name: 'Write with Gemini' }).click();
    await expect(page.locator('.variants .variant').first()).toBeVisible({ timeout: 15_000 });
    await expectAccessible(page);

    await page.reload();
    await expect(party).toBeVisible();
  });

  test('shows the day-of run sheet', async ({ page }) => {
    await openSection(page, 'Day-of');
    await expectAccessible(page);
  });
});
