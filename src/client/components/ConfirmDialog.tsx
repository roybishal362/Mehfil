/**
 * A modal confirmation built on the native <dialog>: the browser traps focus and closes it on
 * Escape. Focus returns to whatever was focused before it opened.
 */
import { useEffect, useRef } from 'react';

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
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      opener.current = document.activeElement;
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const restoreFocus = () => {
    if (opener.current instanceof HTMLElement) opener.current.focus();
  };

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onClose={() => {
        restoreFocus();
        if (open) onCancel();
      }}
    >
      <div className="dialog-body">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-body">{body}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger btn--sm' : 'btn btn--gold btn--sm'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
