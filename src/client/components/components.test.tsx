import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AmountInput } from './AmountInput';
import { CommitInput } from './CommitInput';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorSummary, Field } from './Field';

describe('Field and ErrorSummary', () => {
  it('connects the label, hint and error to the control', async () => {
    const { container } = render(
      <>
        <ErrorSummary
          title="Please fix:"
          items={[{ fieldId: 'city', message: 'Enter the city.' }]}
        />
        <Field
          id="city"
          label="City"
          hint="Where it happens"
          error="Enter the city."
          extra="(required)"
        >
          {(control) => <input {...control} />}
        </Field>
      </>,
    );
    const input = screen.getByRole('textbox', { name: /City/ });
    expect(input).toHaveAccessibleDescription('Enter the city. Where it happens');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(screen.getByRole('link', { name: 'Enter the city.' }));
    expect(input).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders nothing when there is nothing to fix', () => {
    const { container } = render(<ErrorSummary title="Please fix:" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AmountInput', () => {
  function Harness({
    onCommit,
    onInvalid,
  }: {
    onCommit: (value: number) => void;
    onInvalid: () => void;
  }) {
    const [value, setValue] = useState(396_000);
    return (
      <AmountInput
        value={value}
        label="Planned: Venue"
        onCommit={(amount) => {
          onCommit(amount);
          setValue(amount);
        }}
        onInvalid={onInvalid}
      />
    );
  }

  it('reads amounts the way people type them and replaces the old value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onInvalid = vi.fn();
    render(<Harness onCommit={onCommit} onInvalid={onInvalid} />);
    const input = screen.getByRole('textbox', { name: 'Planned: Venue' });
    expect(input).toHaveValue('3,96,000');
    await user.click(input);
    await user.keyboard('4 lakh{Enter}');
    expect(onCommit).toHaveBeenCalledWith(400_000);
    expect(input).toHaveValue('4,00,000');

    await user.click(input);
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);

    await user.click(input);
    await user.keyboard('plenty{Enter}');
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('4,00,000');

    await user.click(input);
    await user.keyboard('9{Escape}');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('CommitInput', () => {
  it('commits once on blur, ignores no-op and empty edits, and cancels on Escape', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<CommitInput value="Baran" label="Title" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Title' });
    await user.click(input);
    await user.keyboard(' ritual{Enter}');
    expect(onCommit).toHaveBeenCalledWith('Baran ritual');
    await user.clear(input);
    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    await user.click(input);
    await user.keyboard('x{Escape}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('Baran');
  });

  it('may clear an optional value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<CommitInput value="Rohan" label="Owner" allowEmpty onCommit={onCommit} />);
    await user.clear(screen.getByRole('textbox', { name: 'Owner' }));
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith('');
  });
});

describe('ConfirmDialog', () => {
  function Harness({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Delete
        </button>
        <ConfirmDialog
          open={open}
          title="Delete this plan?"
          body="It cannot be undone."
          confirmLabel="Delete it"
          cancelLabel="Keep it"
          danger
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
          }}
        />
      </>
    );
  }

  it('asks before acting and returns focus when closed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const opener = screen.getByRole('button', { name: 'Delete' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Delete this plan?' });
    expect(dialog).toHaveAccessibleDescription('It cannot be undone.');
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Delete it' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('treats closing with Escape as cancelling', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    (dialog as HTMLDialogElement).close();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ErrorBoundary', () => {
  it('shows a fallback instead of a blank page and can try again', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let broken = true;
    function Fragile() {
      if (broken) throw new Error('boom');
      return <p>Recovered</p>;
    }
    render(
      <ErrorBoundary
        fallback={(reset) => (
          <button type="button" onClick={reset}>
            Try again
          </button>
        )}
      >
        <Fragile />
      </ErrorBoundary>,
    );
    broken = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
