/**
 * Share a plan as a read-only link. The dialog explains what is and is not shared, creates the
 * link, copies it, refreshes the shared copy after edits, and turns the link off.
 */
import { Copy, Share2, ShieldCheck } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { announce, toast } from '../../app/feedback';
import { useCloudAvailable } from '../../cloud/backend';
import {
  createShareLink,
  refreshShareLink,
  shareUrl,
  stopSharing,
  useShareLinks,
} from '../../cloud/shares';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n';

/** The plan page's Share button; hidden when this server has no cloud features. */
export function ShareButton({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const available = useCloudAvailable();
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return (
    <>
      <button
        type="button"
        className="btn btn--quiet"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Share2 />
        {t.share.button}
      </button>
      {open && (
        <ShareDialog
          plan={plan}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

type Busy = 'create' | 'update' | 'stop' | null;

function ShareDialog({ plan, onClose }: { plan: EventPlan; onClose: () => void }) {
  const { t, f } = useI18n();
  const link = useShareLinks((state) => state.links[plan.id]);
  const [includeBudget, setIncludeBudget] = useState(link?.includeBudget ?? true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const url = link ? shareUrl(link.id) : '';
  const outdated =
    link && (link.revision !== plan.revision || link.includeBudget !== includeBudget);

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<unknown>, done?: string) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      if (done) announce(done);
    } catch {
      setError(t.share.failed);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t.share.copied);
    } catch {
      // Clipboard access can be refused: select the link so it can be copied by hand.
      input.current?.select();
    }
  };

  return (
    <Modal open title={t.share.title} onClose={onClose} className="share">
      <p>{t.share.intro}</p>
      <p className="note share-private">
        <ShieldCheck />
        {t.share.private}
      </p>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="check"
          checked={includeBudget}
          onChange={(event) => {
            setIncludeBudget(event.target.checked);
          }}
        />
        {t.share.includeBudget}
      </label>

      {link ? (
        <>
          <label className="share-label" htmlFor={inputId}>
            {t.share.linkLabel}
          </label>
          <div className="share-row">
            <input
              ref={input}
              id={inputId}
              className="input"
              readOnly
              value={url}
              onFocus={(event) => {
                event.currentTarget.select();
              }}
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void copy()}>
              <Copy />
              {t.share.copy}
            </button>
          </div>
          <p className="note mt-0">{t.share.expires(f.date(link.expiresAt.slice(0, 10)))}</p>
          {outdated && (
            <div className="notice notice--warn">
              <p>{t.share.outdated}</p>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busy !== null}
                onClick={() =>
                  void run('update', () => refreshShareLink(plan, includeBudget), t.share.updated)
                }
              >
                {t.share.update}
              </button>
            </div>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn--danger btn--sm"
              disabled={busy !== null}
              onClick={() => void run('stop', () => stopSharing(plan.id), t.share.stopped)}
            >
              {t.share.stop}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="btn btn--primary justify-self-start"
          disabled={busy !== null}
          onClick={() => void run('create', () => createShareLink(plan, includeBudget))}
        >
          <Share2 />
          {busy === 'create' ? t.share.creating : t.share.create}
        </button>
      )}

      {error && (
        <p className="notice notice--danger" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
