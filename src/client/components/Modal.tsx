/**
 * Modals on the native <dialog>: the browser traps focus inside and closes it on Escape, and
 * focus returns to whatever opened it.
 */
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useI18n } from '../i18n';

/** Shows and hides a <dialog> as a modal with `open`, putting focus back afterwards. */
export function useModalDialog(open: boolean): {
  ref: RefObject<HTMLDialogElement | null>;
  restoreFocus: () => void;
} {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const element = ref.current;
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
  return { ref, restoreFocus };
}

export interface ModalProps {
  open: boolean;
  title: string;
  /** Called when the user closes the modal (close button or Escape). */
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, title, onClose, children, className }: ModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const { ref, restoreFocus } = useModalDialog(open);
  return (
    <dialog
      ref={ref}
      className={className ? `dialog ${className}` : 'dialog'}
      aria-labelledby={titleId}
      onClose={() => {
        restoreFocus();
        if (open) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label={t.common.close} onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
