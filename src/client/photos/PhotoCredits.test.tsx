import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { renderAt } from '../test/helpers';
import { PHOTO_CREDITS } from './credits';
import { PhotoCredits } from './PhotoCredits';

describe('PhotoCredits', () => {
  it('lists every photographer with the work and its licence, opening safely in a new tab', async () => {
    const { container } = renderAt(<PhotoCredits />);
    expect(screen.getByText('Photo credits').tagName).toBe('SUMMARY');
    const items = screen.getAllByRole('listitem', { hidden: true });
    expect(items).toHaveLength(PHOTO_CREDITS.length);
    const [first] = items;
    if (!first) throw new Error('no credits');
    const [work, licence] = within(first).getAllByRole('link', { hidden: true });
    expect(work).toHaveAttribute('href', PHOTO_CREDITS[0]?.source);
    expect(licence).toHaveTextContent(PHOTO_CREDITS[0]?.license ?? '');
    for (const link of container.querySelectorAll('a')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});
