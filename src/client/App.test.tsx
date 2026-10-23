import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the product name as the page heading', async () => {
    const { container } = render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Mehfil' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
