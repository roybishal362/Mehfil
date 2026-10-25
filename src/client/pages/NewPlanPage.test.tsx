import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { useDraft } from '../features/new-plan/draft';
import { mockApi, ndjsonResponse, renderAt } from '../test/helpers';
import { plansStore } from '../state/plans';
import { NewPlanPage } from './NewPlanPage';

const date = `${String(new Date().getFullYear() + 1)}-03-06`;

describe('NewPlanPage', () => {
  it('checks each step, summarises the problems and points to the fields', async () => {
    const user = userEvent.setup();
    const { container } = renderAt(<NewPlanPage />, '/new');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    const summary = screen.getByRole('alert', { name: 'Please fix these before continuing:' });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent('Choose what you are celebrating.');
    expect(screen.getByRole('textbox', { name: /Name of the celebration/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('link', { name: 'Enter the city.' }));
    expect(screen.getByRole('textbox', { name: 'City' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: 'City' }), 'Delhi');
    expect(screen.getByRole('textbox', { name: 'City' })).not.toHaveAttribute('aria-invalid');
  });

  it('walks through all three steps and creates the plan', async () => {
    const user = userEvent.setup();
    mockApi({ '/api/ai/personalize': () => ndjsonResponse([{ type: 'done', ms: 1 }]) });
    const { location } = renderAt(<NewPlanPage />, '/new', 'type=other');
    expect(screen.getByRole('radio', { name: 'Something else' })).toBeChecked();
    await user.type(
      screen.getByRole('textbox', { name: /Name of the celebration/ }),
      'Silver anniversary',
    );
    await user.type(screen.getByLabelText('Date'), date);
    await user.type(screen.getByRole('textbox', { name: 'City' }), 'Delhi');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Venue' }), 'restaurant');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByRole('heading', { level: 2, name: /Guests & budget/ })).toHaveFocus();
    await user.type(screen.getByRole('spinbutton', { name: 'Number of guests' }), '120');
    await user.type(screen.getByRole('textbox', { name: /Total budget/ }), '4 lakh');
    expect(screen.getByText(/= ₹4,00,000/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));

    await user.click(screen.getByRole('checkbox', { name: 'Elegant' }));
    await user.click(screen.getByRole('checkbox', { name: 'Vegetarian' }));
    await user.click(screen.getByRole('checkbox', { name: 'Non-vegetarian' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /Language for the AI/ }), 'hi');
    await user.click(screen.getByRole('button', { name: /Create my plan/ }));

    await waitFor(() => {
      expect(location.history.at(-1)).toMatch(/^\/plan\/evt_/);
    });
    const [id] = plansStore.getState().order;
    expect(id ? plansStore.getState().plans[id]?.brief : undefined).toMatchObject({
      type: 'other',
      title: 'Silver anniversary',
      city: 'Delhi',
      venueType: 'restaurant',
      guestCount: 120,
      budget: 400_000,
      styles: ['Elegant'],
      dietary: ['vegetarian', 'non_vegetarian'],
      language: 'hi',
    });
  });

  it('goes back without losing what was typed', async () => {
    const user = userEvent.setup();
    renderAt(<NewPlanPage />, '/new', 'type=birthday');
    await user.type(
      screen.getByRole('textbox', { name: /Name of the celebration/ }),
      'Mira turns 7',
    );
    await user.type(screen.getByLabelText('Date'), date);
    await user.type(screen.getByRole('textbox', { name: 'City' }), 'Pune');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('textbox', { name: /Name of the celebration/ })).toHaveValue(
      'Mira turns 7',
    );
  });

  it('starts from a festival card with the festival already named', () => {
    renderAt(<NewPlanPage />, '/new', 'type=community&subtype=Durga+Puja');
    expect(screen.getByRole('radio', { name: 'Community' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: /Kind of celebration/ })).toHaveValue('Durga Puja');
  });

  it('continues from a description that was partly understood', () => {
    useDraft.getState().set({ type: 'wedding', city: 'Kolkata', guestCount: 300 }, 'fallback');
    renderAt(<NewPlanPage />, '/new');
    expect(screen.getByRole('status')).toHaveTextContent('The AI could not read that right now');
    expect(screen.getByRole('radio', { name: 'Wedding' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'City' })).toHaveValue('Kolkata');
  });
});
