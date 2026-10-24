/**
 * The account button in the header. Its dialog (sign-in, sync status, deleting data) loads on
 * first use, and a dot on the button flags anything that needs attention.
 */
import { CloudAlert, CloudCheck, CloudOff, UserRound } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useCloud } from '../../cloud/store';
import { useI18n } from '../../i18n';

const AccountDialog = lazy(() =>
  import('./AccountDialog').then((module) => ({ default: module.AccountDialog })),
);

export function AccountButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const google = useCloud((state) => (state.user && !state.user.anonymous ? state.user : null));
  const status = useCloud((state) => state.sync.status);
  const conflicts = useCloud((state) => state.sync.conflicts.length);
  const attention =
    conflicts > 0
      ? t.cloud.conflictPending
      : status === 'offline' || status === 'error'
        ? t.cloud.status[status]
        : null;
  const label = attention ? `${t.cloud.button}. ${attention}` : t.cloud.button;
  const Icon = !google
    ? UserRound
    : attention
      ? status === 'offline'
        ? CloudOff
        : CloudAlert
      : CloudCheck;
  return (
    <>
      <button
        type="button"
        className="roundbtn"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Icon />
        {attention && <span className="attention-dot" aria-hidden="true" />}
      </button>
      {open && (
        <Suspense fallback={null}>
          <AccountDialog
            onClose={() => {
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
