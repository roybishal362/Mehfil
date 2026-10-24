/**
 * When a plan was changed on two devices before they synced, asks which version to keep.
 * Nothing is overwritten until the user chooses; "Decide later" leaves both untouched.
 */
import { useState } from 'react';
import { announce } from '../../app/feedback';
import { resolveConflict } from '../../cloud/account';
import { useCloud } from '../../cloud/store';
import type { ConflictChoice } from '../../cloud/sync';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n';

/** Mounted only while a Google account syncs, the only time conflicts can happen. */
export function ConflictPrompt() {
  const syncing = useCloud((state) => Boolean(state.user && !state.user.anonymous));
  return syncing ? <ConflictModal /> : null;
}

function ConflictModal() {
  const { t } = useI18n();
  const conflict = useCloud((state) =>
    state.conflictsDeferred ? undefined : state.sync.conflicts[0],
  );
  const [working, setWorking] = useState(false);
  const defer = () => {
    useCloud.setState({ conflictsDeferred: true });
  };

  const choose = async (choice: ConflictChoice) => {
    if (!conflict) return;
    setWorking(true);
    try {
      await resolveConflict(
        conflict.local.id,
        choice,
        t.cloud.copyTitle(conflict.local.brief.title),
      );
      announce(t.cloud.conflictResolved);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal open={conflict !== undefined} title={t.cloud.conflictTitle} onClose={defer}>
      {conflict && (
        <>
          <p>{t.cloud.conflictText(conflict.local.brief.title)}</p>
          <div className="dialog-actions dialog-actions--stack">
            <button
              type="button"
              className="btn btn--gold btn--sm"
              disabled={working}
              onClick={() => void choose('local')}
            >
              {t.cloud.keepLocal}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={working}
              onClick={() => void choose('remote')}
            >
              {t.cloud.keepRemote}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={working}
              onClick={() => void choose('both')}
            >
              {t.cloud.keepBoth}
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={defer}>
              {t.cloud.decideLater}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
