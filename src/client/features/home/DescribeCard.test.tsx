import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { META, ideasData } from '../../test/ai-fixtures';
import { jsonResponse, mockApi, ndjsonResponse, renderAt } from '../../test/helpers';
import { plansStore } from '../../state/plans';
import { useDraft } from '../new-plan/draft';
import { DescribeCard } from './DescribeCard';

const FULL =
  'A Bengali wedding in Kolkata on 14 Feb 2031 for 300 guests, budget ₹18 lakh, veg and Jain food';

function nextYearDate(): string {
  return `${String(new Date().getFullYear() + 1)}-02-14`;
}

describe('DescribeCard', () => {
  it('shows what it understood while typing', async () => {
    const user = userEvent.setup();
    const { container } = renderAt(<DescribeCard />);
    expect(
      screen.getByText('Mention the occasion, date, city, guests and budget.'),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Describe your celebration' }),
      'A birthday in Pune for 40 people, budget 60k',
    );
    const understood = await screen.findByRole('list', { name: 'Understood' });
    expect(understood).toHaveTextContent('Birthday');
    expect(understood).toHaveTextContent('Pune');
    expect(understood).toHaveTextContent('40 guests');
    expect(understood).toHaveTextContent('₹60,000');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('fills the box from an example', async () => {
    const user = userEvent.setup();
    renderAt(<DescribeCard />);
    await user.click(screen.getByRole('button', { name: 'Durga Puja feast for 800' }));
    expect(screen.getByRole('textbox', { name: 'Describe your celebration' })).toHaveValue(
      'Durga Puja community feast in Kolkata on 17 Oct 2027 for 800 people, budget ₹6 lakh, pure veg bhog.',
    );
  });

  it('asks for a description before planning', async () => {
    const user = userEvent.setup();
    renderAt(<DescribeCard />);
    await user.click(screen.getByRole('button', { name: 'Plan my celebration' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tell us a little about your celebration first.',
    );
    expect(screen.getByRole('textbox', { name: 'Describe your celebration' })).toHaveFocus();
  });

  it('creates and opens a plan when Gemini understood everything', async () => {
    const user = userEvent.setup();
    const date = nextYearDate();
    mockApi({
      '/api/ai/brief': () =>
        jsonResponse({
          brief: {
            type: 'wedding',
            title: "Ananya & Rohan's Wedding",
            date,
            city: 'Kolkata',
            guestCount: 300,
            budget: 1_800_000,
          },
          missing: [],
          meta: META,
        }),
      '/api/ai/personalize': () =>
        ndjsonResponse([
          { type: 'section', section: 'ideas', data: ideasData, meta: META },
          { type: 'done', ms: 10 },
        ]),
    });
    const { location } = renderAt(<DescribeCard />);
    await user.type(screen.getByRole('textbox', { name: 'Describe your celebration' }), FULL);
    await user.click(screen.getByRole('button', { name: 'Plan my celebration' }));
    await waitFor(() => {
      expect(location.history.at(-1)).toMatch(/^\/plan\/evt_/);
    });
    const [id] = plansStore.getState().order;
    const plan = id ? plansStore.getState().plans[id] : undefined;
    expect(plan?.brief).toMatchObject({ title: "Ananya & Rohan's Wedding", date, language: 'en' });
    await waitFor(() => {
      expect(plansStore.getState().plans[id ?? '']?.ideas.length).toBeGreaterThan(0);
    });
  });

  it('continues in the form when details are missing', async () => {
    const user = userEvent.setup();
    mockApi({
      '/api/ai/brief': () =>
        jsonResponse({ brief: { type: 'birthday', city: 'Pune' }, missing: ['date'], meta: META }),
    });
    const { location } = renderAt(<DescribeCard />);
    await user.type(
      screen.getByRole('textbox', { name: 'Describe your celebration' }),
      'A birthday in Pune',
    );
    await user.click(screen.getByRole('button', { name: 'Plan my celebration' }));
    await waitFor(() => {
      expect(location.history.at(-1)).toBe('/new');
    });
    expect(useDraft.getState()).toMatchObject({
      notice: 'prefilled',
      draft: { type: 'birthday', city: 'Pune', title: 'Birthday in Pune' },
    });
  });

  it('falls back to its own reading when the AI is unavailable', async () => {
    const user = userEvent.setup();
    mockApi({ '/api/ai/brief': () => jsonResponse({ code: 'ai_unavailable', message: 'x' }, 503) });
    renderAt(<DescribeCard />);
    await user.type(
      screen.getByRole('textbox', { name: 'Describe your celebration' }),
      'A wedding in Kolkata for 300 guests',
    );
    await user.click(screen.getByRole('button', { name: 'Plan my celebration' }));
    await waitFor(() => {
      expect(useDraft.getState().notice).toBe('fallback');
    });
    expect(useDraft.getState().draft).toMatchObject({
      type: 'wedding',
      city: 'Kolkata',
      guestCount: 300,
    });
  });
});
