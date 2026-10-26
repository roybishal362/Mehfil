/**
 * Account and sync: sign in with Google to keep plans on every device, see how sync is doing,
 * sign out, and delete data in the cloud or on this device.
 */
import { ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { announce, toast } from '../../app/feedback';
import { deleteCloudData, signInWithGoogle, signOut, syncNow } from '../../cloud/account';
import { useCloudAvailable } from '../../cloud/backend';
import { forgetShareLinks } from '../../cloud/share-links';
import { useCloud } from '../../cloud/store';
import type { CloudUser } from '../../cloud/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n';
import { plansStore, usePlans } from '../../state/plans';
import { accountError } from './errors';

/** Runs an account action and keeps its error (if any) to show in the dialog. */
type RunAction = (action: () => Promise<void>, done?: string, signingIn?: boolean) => Promise<void>;

function useAccountAction(): { error: string | null; run: RunAction } {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const run: RunAction = async (action, done, signingIn = false) => {
    setError(null);
    try {
      await action();
      if (done) toast(done);
    } catch (failure) {
      setError(accountError(failure, t, signingIn));
    }
  };
  return { error, run };
}

/** Conflicts set aside earlier: a reminder, and a way back to settling them. */
function ConflictReminder({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const deferred = useCloud((state) => state.conflictsDeferred);
  const conflicts = useCloud((state) => state.sync.conflicts.length);
  if (!deferred || conflicts === 0) return null;
  return (
    <div className="notice notice--warn">
      <p>{t.cloud.conflictPending}</p>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => {
          useCloud.setState({ conflictsDeferred: false });
          onClose();
        }}
      >
        {t.cloud.review}
      </button>
    </div>
  );
}

function GoogleAccount({ google, run }: { google: CloudUser; run: RunAction }) {
  const { t, f } = useI18n();
  const sync = useCloud((state) => state.sync);
  const busy = useCloud((state) => state.busy);
  const lastSynced =
    sync.lastSyncedAt && sync.status === 'idle'
      ? ` ${t.cloud.lastSynced(f.timeOfDay(sync.lastSyncedAt))}`
      : '';
  return (
    <>
      <p className="account-who">
        <UserRound />
        {t.cloud.signedInAs(google.name ?? google.email ?? '')}
      </p>
      <p className="note mt-0" role="status">
        {t.cloud.status[sync.status]}
        {lastSynced}
      </p>
      <div className="dialog-actions dialog-actions--start">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={busy !== null || sync.status === 'syncing'}
          onClick={() => void run(syncNow)}
        >
          {t.cloud.syncNow}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={busy !== null}
          onClick={() => void run(signOut, t.cloud.signedOut)}
        >
          {t.cloud.signOut}
        </button>
      </div>
      <p className="note mt-0">{t.cloud.signOutNote}</p>
    </>
  );
}

/** Plans live on this device only; the pitch for Google sign-in when the cloud is set up. */
function LocalOnly({ available, run }: { available: boolean; run: RunAction }) {
  const { t } = useI18n();
  const busy = useCloud((state) => state.busy);
  return (
    <>
      <p>{t.cloud.localOnly}</p>
      {available && (
        <>
          <p>{t.cloud.pitch}</p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy !== null}
            onClick={() => void run(signInWithGoogle, undefined, true)}
          >
            {busy === 'signin' ? t.cloud.signingIn : t.cloud.signIn}
          </button>
        </>
      )}
    </>
  );
}

type Deletion = 'cloud' | 'local';

/** Deleting data: the cloud copy for any account, this device's plans when not syncing. */
function DataControls({
  google,
  onDelete,
}: {
  google: boolean;
  onDelete: (what: Deletion) => void;
}) {
  const { t } = useI18n();
  const user = useCloud((state) => state.user);
  const busy = useCloud((state) => state.busy);
  const planCount = usePlans((state) => state.order.length);
  if (user === null && planCount === 0) return null;
  return (
    <section className="account-data" aria-labelledby="account-data-title">
      <h3 id="account-data-title">{t.cloud.dataTitle}</h3>
      <div className="dialog-actions dialog-actions--start">
        {user && (
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={busy !== null}
            onClick={() => {
              onDelete('cloud');
            }}
          >
            {t.cloud.deleteCloud}
          </button>
        )}
        {!google && planCount > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              onDelete('local');
            }}
          >
            {t.cloud.deleteLocal}
          </button>
        )}
      </div>
    </section>
  );
}

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const available = useCloudAvailable();
  const user = useCloud((state) => state.user);
  const [confirm, setConfirm] = useState<Deletion | null>(null);
  const { error, run } = useAccountAction();
  const google = user && !user.anonymous ? user : null;

  const deleteLocalPlans = () => {
    plansStore.getState().hydrate([]);
    forgetShareLinks();
    announce(t.cloud.deleteLocalDone);
    toast(t.cloud.deleteLocalDone);
  };
  const cancel = () => {
    setConfirm(null);
  };

  return (
    <>
      <Modal open title={t.cloud.title} onClose={onClose} className="account">
        <ConflictReminder onClose={onClose} />
        {google ? (
          <GoogleAccount google={google} run={run} />
        ) : (
          <LocalOnly available={available} run={run} />
        )}
        {error && (
          <p className="notice notice--danger" role="alert">
            {error}
          </p>
        )}
        {available && (
          <p className="note account-privacy">
            <ShieldCheck />
            {t.cloud.privacy}
          </p>
        )}
        <DataControls google={google !== null} onDelete={setConfirm} />
      </Modal>

      <ConfirmDialog
        open={confirm === 'cloud'}
        title={t.cloud.deleteCloudTitle}
        body={t.cloud.deleteCloudBody}
        confirmLabel={t.cloud.deleteCloudConfirm}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => {
          setConfirm(null);
          void run(deleteCloudData, t.cloud.deleteCloudDone);
        }}
        onCancel={cancel}
      />
      <ConfirmDialog
        open={confirm === 'local'}
        title={t.cloud.deleteLocalTitle}
        body={t.cloud.deleteLocalBody}
        confirmLabel={t.cloud.deleteLocalConfirm}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => {
          setConfirm(null);
          deleteLocalPlans();
        }}
        onCancel={cancel}
      />
    </>
  );
}
