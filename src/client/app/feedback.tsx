/**
 * Feedback for people using the app: visible toasts (with an optional action such as Undo) and
 * a hidden live region that announces background events, such as an AI section finishing, to
 * screen readers.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { useI18n } from '../i18n';

interface ToastAction {
  label: string;
  run: () => void;
}

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: ToastAction;
}

interface FeedbackState {
  toasts: readonly Toast[];
  announcement: { id: number; text: string };
  toast: (message: string, options?: { tone?: Toast['tone']; action?: ToastAction }) => number;
  dismiss: (id: number) => void;
  announce: (text: string) => void;
}

let nextId = 1;

export const useFeedback = create<FeedbackState>()((set) => ({
  toasts: [],
  announcement: { id: 0, text: '' },
  toast: (message, { tone = 'info', action } = {}) => {
    const id = nextId++;
    set((state) => ({
      // Keep the three most recent so the stack never covers the page.
      toasts: [...state.toasts, { id, message, tone, ...(action ? { action } : {}) }].slice(-3),
    }));
    return id;
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  announce: (text) => {
    set({ announcement: { id: nextId++, text } });
  },
}));

export const toast: FeedbackState['toast'] = (...args) => useFeedback.getState().toast(...args);
export const announce: FeedbackState['announce'] = (text) => {
  useFeedback.getState().announce(text);
};

const TOAST_MS = 6000;
const TOAST_WITH_ACTION_MS = 9000;

function ToastItem({ item }: { item: Toast }) {
  const { t } = useI18n();
  const dismiss = useFeedback((state) => state.dismiss);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        dismiss(item.id);
      },
      item.action ? TOAST_WITH_ACTION_MS : TOAST_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [dismiss, item.action, item.id]);

  return (
    <div className="toast" role={item.tone === 'error' ? 'alert' : 'status'}>
      <p>{item.message}</p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.run();
            dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={t.common.close}
        onClick={() => {
          dismiss(item.id);
        }}
      >
        ×
      </button>
    </div>
  );
}

/** Visible notifications plus the hidden announcer. Render once, near the end of the page. */
export function Feedback() {
  const toasts = useFeedback((state) => state.toasts);
  const announcement = useFeedback((state) => state.announcement);
  return (
    <>
      <div className="toasts">
        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={announcement.id}>{announcement.text}</span>
      </p>
    </>
  );
}
