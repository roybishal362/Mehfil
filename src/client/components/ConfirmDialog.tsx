/**
 * A modal confirmation built on the native <dialog>: the browser traps focus and closes it on
 * Escape. Focus returns to whatever was focused before it opened.
 */
import { useId } from 'react';
import { useModalDialog } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { ref: dialog, restoreFocus } = useModalDialog(open);
  const id = useId();

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onClose={() => {
        restoreFocus();
        if (open) onCancel();
      }}
    >
      <div className="dialog-body">
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-body`}>{body}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger btn--sm' : 'btn btn--primary btn--sm'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
