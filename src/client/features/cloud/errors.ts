/** Turning failed account actions into messages for the user. */
import type { Messages } from '../../i18n';

/** Error codes that mean the user closed the Google window themselves. */
const CANCELLED = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}

/** What to tell the user when an account action fails (nothing when they cancelled it). */
export function accountError(error: unknown, t: Messages, signingIn = false): string | null {
  const code = codeOf(error);
  if (code && CANCELLED.has(code)) return null;
  if (code === 'auth/popup-blocked') return t.cloud.popupBlocked;
  return signingIn ? t.cloud.failed : t.cloud.actionFailed;
}
