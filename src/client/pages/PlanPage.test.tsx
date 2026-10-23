import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { META, ideasData } from '../test/ai-fixtures';
import { jsonResponse, mockApi, ndjsonResponse, renderAt, seedPlan } from '../test/helpers';
import { useAiRuns } from '../state/ai';
import { plansStore } from '../state/plans';
import { PlanPage } from './PlanPage';

function open(section?: string) {
  const plan = seedPlan();
  const path = section ? `/plan/${plan.id}/${section}` : `/plan/${plan.id}`;
  const view = renderAt(
    <PlanPage params={{ id: plan.id, ...(section ? { section } : {}) }} />,
    path,
  );
  return { plan, ...view };
}

const current = (id: string) => {
  const plan = plansStore.getState().plans[id];
  if (!plan) throw new Error('plan missing');
  return plan;
};

describe('PlanPage', () => {
  it('opens like an invitation with the overview', async () => {
    const { container } = open();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ananya&Rohan');
    expect(screen.getByRole('img', { name: /Countdown: \d+ days to go/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Plan \d+% ready/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Today’s focus' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Budget split:/ })).toBeInTheDocument();
    expect(screen.getByText('Standard plan. Ask Gemini to tailor it.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows a friendly page for an unknown plan', () => {
    renderAt(<PlanPage params={{ id: 'evt_missing' }} />, '/plan/evt_missing');
    expect(
      screen.getByRole('heading', { level: 1, name: 'We could not find that plan' }),
    ).toBeInTheDocument();
  });

  it('ticks off a focus task and undoes it', async () => {
    const user = userEvent.setup();
    const { plan } = open();
    const [first] = screen.getAllByRole('checkbox', { name: /^Mark “.*” as done$/ });
    if (!first) throw new Error('no focus tasks');
    await user.click(first);
    expect(current(plan.id).tasks.filter((task) => task.status === 'done')).toHaveLength(1);
    const history = screen.getByRole('group', { name: 'Undo and redo' });
    await user.click(within(history).getByRole('button', { name: 'Undo' }));
    expect(current(plan.id).tasks.filter((task) => task.status === 'done')).toHaveLength(0);
    await user.click(within(history).getByRole('button', { name: 'Redo' }));
    expect(current(plan.id).tasks.filter((task) => task.status === 'done')).toHaveLength(1);
  });

  it('tailors a plan with Gemini on request and shows progress while it streams', async () => {
    const user = userEvent.setup();
    mockApi({
      '/api/ai/personalize': () =>
        ndjsonResponse([
          { type: 'section', section: 'ideas', data: ideasData, meta: META },
          { type: 'section_error', section: 'vendors', code: 'unavailable', message: 'Busy' },
          { type: 'done', ms: 10 },
        ]),
    });
    const { plan } = open();
    await user.click(screen.getByRole('button', { name: 'Tailor with Gemini' }));
    await waitFor(() => {
      expect(useAiRuns.getState().runs[plan.id]?.running).toBe(false);
    });
    expect(
      (await screen.findAllByText(/Vendors could not be tailored right now/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'In a nutshell' })).toBeInTheDocument();
    expect(screen.getByText('Shubho Alo')).toBeInTheDocument();
  });

  it('asks the Copilot and applies its proposal', async () => {
    const user = userEvent.setup();
    mockApi({
      '/api/ai/copilot': () =>
        jsonResponse({
          reply: 'I will plan for 350 guests.',
          operations: [{ type: 'guests.setCount', guestCount: 350, keepBudget: true }],
          dropped: 0,
          meta: META,
        }),
    });
    const { plan } = open();
    await user.click(screen.getByRole('button', { name: 'We now expect 50 more guests' }));
    const copilot = screen.getByRole('complementary', { name: 'Copilot' });
    await within(copilot).findByText('I will plan for 350 guests.');
    expect(within(copilot).getByRole('checkbox', { name: /Guests/ })).toBeChecked();
    await user.click(within(copilot).getByText('What changes'));
    await user.click(within(copilot).getByRole('button', { name: 'Apply 1 change' }));
    expect(current(plan.id).brief.guestCount).toBe(350);
    expect(screen.getByRole('status')).toHaveTextContent('Applied 1 change.');
  });

  it('types a question into the Copilot', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      '/api/ai/copilot': () =>
        jsonResponse({ reply: 'Book the venue first.', operations: [], dropped: 0, meta: META }),
    });
    open();
    await user.type(screen.getByRole('textbox', { name: 'Ask Copilot' }), 'What first?{Enter}');
    expect(await screen.findByText('Book the venue first.')).toBeInTheDocument();
    expect(calls[0]?.body).toMatchObject({ message: 'What first?' });
  });
});

describe('plan sections', () => {
  it.each(['budget', 'timeline', 'vendors', 'ideas', 'guests', 'day-of'])(
    '%s has a focusable heading and no axe violations',
    async (section) => {
      const { container } = open(section);
      const heading = container.querySelector('[data-route-focus="section"]');
      expect(heading?.tagName).toBe('H2');
      expect(heading).toHaveAttribute('tabindex', '-1');
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('budget: edits a line, adds one, changes the total and the guest count', async () => {
    const user = userEvent.setup();
    const { plan } = open('budget');
    const venue = screen.getByRole('textbox', { name: 'Planned: Venue' });
    await user.click(venue);
    await user.keyboard('{Control>}a{/Control}2.5 lakh{Enter}');
    expect(current(plan.id).budget.lines.find((line) => line.category === 'venue')?.planned).toBe(
      250_000,
    );

    await user.click(screen.getByRole('textbox', { name: 'Paid: Venue' }));
    await user.keyboard('{Control>}a{/Control}lots{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an amount');

    await user.type(screen.getByRole('textbox', { name: 'What is it for?' }), 'Dhaki drummers');
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '20k');
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    expect(current(plan.id).budget.lines.at(-1)).toMatchObject({
      label: 'Dhaki drummers',
      planned: 20_000,
    });

    await user.click(screen.getByRole('button', { name: 'Remove Dhaki drummers' }));
    expect(current(plan.id).budget.lines.some((line) => line.label === 'Dhaki drummers')).toBe(
      false,
    );

    await user.type(screen.getByRole('textbox', { name: 'New total' }), '20 lakh');
    await user.click(screen.getByRole('button', { name: 'Rebalance the lines' }));
    expect(current(plan.id).budget.total).toBe(2_000_000);

    const guests = screen.getByRole('spinbutton', { name: 'Number of guests' });
    await user.clear(guests);
    await user.type(guests, '350');
    await user.click(screen.getByRole('button', { name: 'Update the guest count' }));
    expect(current(plan.id).brief.guestCount).toBe(350);
    expect(current(plan.id).budget.total).toBe(2_000_000);
  });

  it('timeline: filters, ticks, adds and removes tasks, and exports a calendar', async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mehfil');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const { plan } = open('timeline');
    const firstTask = plan.tasks[0];
    if (!firstTask) throw new Error('no tasks');
    await user.click(screen.getByRole('checkbox', { name: `Mark “${firstTask.title}” as done` }));
    expect(current(plan.id).tasks[0]?.status).toBe('done');
    expect(screen.queryByText(firstTask.title)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText(firstTask.title)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All' }));

    await user.type(screen.getByRole('textbox', { name: 'Task' }), 'Book the shehnai');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('due date');

    const due = `${String(new Date().getFullYear() + 1)}-01-10`;
    await user.type(screen.getByLabelText('Due by'), due);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'high');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(current(plan.id).tasks.some((task) => task.title === 'Book the shehnai')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Remove “Book the shehnai”' }));
    expect(current(plan.id).tasks.some((task) => task.title === 'Book the shehnai')).toBe(false);

    expect(
      screen.getAllByRole('link', { name: /to Google Calendar/ })[0]?.getAttribute('href'),
    ).toMatch(/^https:\/\/calendar\.google\.com\//);
    await user.click(screen.getByRole('button', { name: 'Download calendar' }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('vendors: changes status, records quotes, chooses one and removes vendors', async () => {
    const user = userEvent.setup();
    const { plan } = open('vendors');
    const venue = screen.getByRole('article', { name: 'Venue' });
    await user.selectOptions(within(venue).getByRole('combobox', { name: 'Status' }), 'booked');
    expect(current(plan.id).vendors.find((v) => v.category === 'venue')?.status).toBe('booked');
    expect(within(venue).getByRole('link', { name: /Find on Google Maps/ })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/search'),
    );

    await user.click(within(venue).getByText('Add a quote', { selector: 'summary' }));
    await user.type(within(venue).getByRole('textbox', { name: 'Vendor name' }), 'Sen Banquets');
    await user.type(within(venue).getByRole('textbox', { name: 'Quote' }), '4 lakh');
    await user.click(within(venue).getByRole('button', { name: 'Add a quote' }));
    await user.click(within(venue).getByRole('button', { name: 'Choose: Sen Banquets' }));
    const booked = current(plan.id).vendors.find((v) => v.category === 'venue');
    expect(booked?.options[0]).toMatchObject({ name: 'Sen Banquets', quote: 400_000 });
    expect(booked?.selectedOptionId).toBe(booked?.options[0]?.id);
    expect(within(venue).getByText('₹4,00,000 counted in your budget')).toBeInTheDocument();
    await user.click(
      within(venue).getByRole('button', { name: 'Remove the quote from Sen Banquets' }),
    );

    await user.type(screen.getByRole('textbox', { name: 'What do you need?' }), 'Dhaki drummers');
    await user.type(
      screen.getByLabelText('Book by'),
      `${String(new Date().getFullYear() + 1)}-01-05`,
    );
    await user.click(screen.getByRole('button', { name: 'Add vendor' }));
    expect(current(plan.id).vendors.some((v) => v.label === 'Dhaki drummers')).toBe(true);
    const added = screen.getByRole('article', { name: 'Dhaki drummers' });
    await user.click(within(added).getByRole('button', { name: /Remove from checklist/ }));
    expect(current(plan.id).vendors.some((v) => v.label === 'Dhaki drummers')).toBe(false);
  });

  it('ideas: asks for different ideas, keeps and removes them', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      '/api/ai/refine': () => jsonResponse({ section: 'ideas', data: ideasData, meta: META }),
    });
    const { plan } = open('ideas');
    expect(
      screen.getByText('Ideas appear here once Gemini has tailored your plan.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eco-friendly' }));
    expect(await screen.findByRole('heading', { name: 'Mishti doi bar' })).toBeInTheDocument();
    expect(calls[0]?.body).toMatchObject({ section: 'ideas', instruction: 'Eco-friendly' });

    await user.click(screen.getByRole('button', { name: 'Keep: Mishti doi bar' }));
    expect(current(plan.id).ideas.find((idea) => idea.title === 'Mishti doi bar')?.favorite).toBe(
      true,
    );
    await user.click(screen.getByRole('button', { name: 'Kept' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toContain(
      'Mishti doi bar',
    );
    await user.click(screen.getByRole('button', { name: 'Remove “Mishti doi bar”' }));
    expect(current(plan.id).ideas.some((idea) => idea.title === 'Mishti doi bar')).toBe(false);

    await user.type(
      screen.getByRole('textbox', { name: 'What would you like instead?' }),
      'More sweets{Enter}',
    );
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
  });

  it('ideas: says so when Gemini cannot refine', async () => {
    const user = userEvent.setup();
    mockApi({
      '/api/ai/refine': () => jsonResponse({ code: 'ai_unavailable', message: 'x' }, 503),
    });
    open('ideas');
    await user.click(screen.getByRole('button', { name: 'Eco-friendly' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not come up with new ideas');
  });

  it('guests: adds, edits, imports and exports guests, and writes the invitation', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mehfil');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mockApi({
      '/api/ai/invitation': () =>
        jsonResponse({
          variants: [
            { label: 'Warm', text: 'Please join us.' },
            { label: 'Short', text: 'You are invited!' },
          ],
          meta: META,
        }),
    });
    const { plan } = open('guests');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Mashi and family');
    await user.clear(screen.getByRole('spinbutton', { name: 'People' }));
    await user.type(screen.getByRole('spinbutton', { name: 'People' }), '4');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    expect(current(plan.id).guests[0]).toMatchObject({ name: 'Mashi and family', partySize: 4 });

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'RSVP from Mashi and family' }),
      'yes',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Food preference of Mashi and family' }),
      'jain',
    );
    expect(current(plan.id).guests[0]).toMatchObject({ rsvp: 'yes', dietary: 'jain' });

    const file = new File(['Name,Party size,RSVP\nRina,2,yes\n,3,no\n'], 'guests.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText('Import CSV'), file);
    await waitFor(() => {
      expect(current(plan.id).guests).toHaveLength(2);
    });
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await user.click(screen.getByRole('button', { name: 'Remove Rina' }));
    expect(current(plan.id).guests).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Write with Gemini' }));
    expect(await screen.findByText('Please join us.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy: Warm' }));
    expect(writeText).toHaveBeenCalledWith('Please join us.');
    expect(screen.getAllByRole('link', { name: /Share on WhatsApp/ })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('wa.me'),
    );
  });

  it('day-of: adds a moment, names who is in charge and removes it', async () => {
    const user = userEvent.setup();
    const { plan } = open('day-of');
    await user.type(screen.getByLabelText('Time'), '20:15');
    await user.type(screen.getByRole('textbox', { name: 'What happens' }), 'Baran ritual');
    await user.click(screen.getByRole('button', { name: 'Add moment' }));
    const added = current(plan.id).schedule.find((item) => item.title === 'Baran ritual');
    expect(added).toMatchObject({ time: '20:15', durationMinutes: 60 });

    expect(screen.getAllByRole('textbox', { name: /^What happens at / }).length).toBeGreaterThan(1);
    const owner = screen.getByRole('textbox', { name: 'Person in charge of Baran ritual' });
    await user.type(owner, 'Rohan’s cousin{Enter}');
    expect(current(plan.id).schedule.find((item) => item.title === 'Baran ritual')?.owner).toBe(
      'Rohan’s cousin',
    );
    await user.click(screen.getByRole('button', { name: 'Remove Baran ritual' }));
    expect(current(plan.id).schedule.some((item) => item.title === 'Baran ritual')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Add moment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Give the moment a name');
  });
});
