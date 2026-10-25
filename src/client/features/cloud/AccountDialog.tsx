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
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n';
import { plansStore, usePlans } from '../../state/plans';
import { accountError } from './errors';

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const { t, f } = useI18n();
  const available = useCloudAvailable();
  const user = useCloud((state) => state.user);
  const sync = useCloud((state) => state.sync);
  const busy = useCloud((state) => state.busy);
  const deferred = useCloud((state) => state.conflictsDeferred);
  const planCount = usePlans((state) => state.order.length);
  const [confirm, setConfirm] = useState<'cloud' | 'local' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const google = user && !user.anonymous ? user : null;

  const run = async (action: () => Promise<void>, done?: string, signingIn = false) => {
    setError(null);
    try {
      await action();
      if (done) toast(done);
    } catch (failure) {
      setError(accountError(failure, t, signingIn));
    }
  };

  const deleteLocalPlans = () => {
    plansStore.getState().hydrate([]);
    forgetShareLinks();
    announce(t.cloud.deleteLocalDone);
    toast(t.cloud.deleteLocalDone);
  };

  return (
    <>
      <Modal open title={t.cloud.title} onClose={onClose} className="account">
        {deferred && sync.conflicts.length > 0 && (
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
        )}

        {google ? (
          <>
            <p className="account-who">
              <UserRound />
              {t.cloud.signedInAs(google.name ?? google.email ?? '')}
            </p>
            <p className="note mt-0" role="status">
              {t.cloud.status[sync.status]}
              {sync.lastSyncedAt && sync.status === 'idle'
                ? ` ${t.cloud.lastSynced(f.timeOfDay(sync.lastSyncedAt))}`
                : ''}
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
        ) : (
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

        {(user !== null || planCount > 0) && (
          <section className="account-data" aria-labelledby="account-data-title">
            <h3 id="account-data-title">{t.cloud.dataTitle}</h3>
            <div className="dialog-actions dialog-actions--start">
              {user && (
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={busy !== null}
                  onClick={() => {
                    setConfirm('cloud');
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
                    setConfirm('local');
                  }}
                >
                  {t.cloud.deleteLocal}
                </button>
              )}
            </div>
          </section>
        )}
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
        onCancel={() => {
          setConfirm(null);
        }}
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
        onCancel={() => {
          setConfirm(null);
        }}
      />
    </>
  );
}
