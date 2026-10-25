import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { renderAt, seedPlan } from '../../test/helpers';
import { plansStore } from '../../state/plans';
import { Occasions } from './Occasions';
import { YourPlans } from './YourPlans';

describe('Occasions', () => {
  it('starts a plan for each occasion, naming the festival for pujas and Diwali', async () => {
    const { container } = renderAt(<Occasions />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/new?type=wedding',
      '/new?type=community&subtype=Durga+Puja',
      '/new?type=community&subtype=Ganpati',
      '/new?type=birthday',
      '/new?type=other&subtype=Diwali',
      '/new?type=other',
    ]);
    // Each card wears its festival's colours.
    expect(links.map((link) => link.dataset.mood)).toEqual([
      'wedding',
      'durga',
      'ganpati',
      'birthday',
      'diwali',
      'neutral',
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('YourPlans', () => {
  it('is hidden until a plan exists', () => {
    const { container } = renderAt(<YourPlans />);
    expect(container.querySelector('.plans-list')).toBeNull();
  });

  it('deletes a plan after confirmation and can bring it back', async () => {
    const user = userEvent.setup();
    const plan = seedPlan({ title: 'Mira turns 7', type: 'birthday' });
    renderAt(<YourPlans />);
    const tile = screen.getByRole('listitem');
    expect(within(tile).getByRole('link', { name: 'Mira turns 7' })).toHaveAttribute(
      'href',
      `/plan/${plan.id}`,
    );
    expect(tile).toHaveTextContent(/days to go/);

    await user.click(within(tile).getByRole('button', { name: /Delete: Mira turns 7/ }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “Mira turns 7”?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(plansStore.getState().order).toEqual([plan.id]);

    await user.click(within(tile).getByRole('button', { name: /Delete: Mira turns 7/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(plansStore.getState().order).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Deleted “Mira turns 7”.');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(plansStore.getState().order).toEqual([plan.id]);
  });
});
