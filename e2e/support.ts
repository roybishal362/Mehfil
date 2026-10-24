/**
 * Shared end-to-end fixtures. Every test fails on a console error, an uncaught page error or a
 * Content-Security-Policy violation, and `expectAccessible` scans the page with axe-core
 * against the WCAG 2.2 A and AA rules and checks that it never scrolls sideways (reflow).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
      });
      page.on('pageerror', (error) => {
        problems.push(`page error: ${error.message}`);
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          // Reported through the console so the listener above collects it.
          // eslint-disable-next-line no-console
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      await use(problems);
      expect(problems, 'console errors, page errors or CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
  );
  expect(violations, 'axe violations').toEqual([]);
  await expectNoSidewaysScrolling(page);
}

/**
 * WCAG 1.4.10 Reflow: nothing may make the page scroll sideways, at the device's width or on
 * narrow phones (390 px is a common iPhone width; 320 px is the WCAG reference).
 */
async function expectNoSidewaysScrolling(page: Page): Promise<void> {
  const original = page.viewportSize();
  if (!original) return;
  for (const width of new Set([original.width, 390, 320])) {
    await page.setViewportSize({ width, height: original.height });
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, `page width at ${String(width)} px`).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize(original);
}

export const WEDDING =
  'A Bengali wedding of Ananya and Rohan in Kolkata on 14 Feb 2027 for about 300 guests. ' +
  'Budget ₹18 lakh, mostly vegetarian, and my grandparents need wheelchair access.';

/** Describes a celebration on the home page and waits until Gemini has tailored every part. */
export async function describeCelebration(page: Page, description = WEDDING): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Describe your celebration').fill(description);
  await page.getByRole('button', { name: 'Plan my celebration' }).click();
  await page.waitForURL(/\/plan\/[^/]+$/);
  await expect(page.locator('.ai-status')).toHaveCount(0, { timeout: 30_000 });
}

/** Opens one of the plan's sections from its tabs. */
export async function openSection(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Plan sections' }).getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}
