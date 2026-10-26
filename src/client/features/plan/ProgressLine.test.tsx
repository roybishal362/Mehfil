import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { renderAt } from '../../test/helpers';
import type { PlanPart } from './present';
import { ProgressLine } from './ProgressLine';

const PARTS: PlanPart[] = [
  { key: 'budget', label: 'Budget', value: 0.6, caption: '60%' },
  { key: 'timeline', label: 'Timeline', value: 0.2, caption: '20%' },
  { key: 'vendors', label: 'Vendors', value: 0, caption: 'not started' },
  { key: 'guests', label: 'Guests', value: 0, caption: 'not started' },
  { key: 'ideas', label: 'Ideas', value: 1, caption: '100%' },
  { key: 'dayOf', label: 'Day-of', value: 0, caption: 'not started' },
];

describe('ProgressLine', () => {
  it('fills a segment for each part begun and says the same in words', async () => {
    const { container } = renderAt(<ProgressLine parts={PARTS} status="45% ready" />);
    const segments = [...container.querySelectorAll('.progress-segments i')];
    expect(segments.map((segment) => segment.classList.contains('is-begun'))).toEqual([
      true,
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(container.querySelector('.progress-segments')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('3 of 6 parts begun · 45% ready')).toBeInTheDocument();
    // Screen readers also hear each part.
    expect(
      screen.getByText(/Plan progress: Budget 60%, Timeline 20%, Vendors not started/),
    ).toHaveClass('sr-only');
    expect(await axe(container)).toHaveNoViolations();
  });
});
