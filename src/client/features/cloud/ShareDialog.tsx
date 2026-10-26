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
  type ShareLink,
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
type Run = (
  kind: Exclude<Busy, null>,
  action: () => Promise<unknown>,
  done?: string,
) => Promise<void>;

/** The link itself, selected on focus, with a Copy button. */
function LinkField({ url }: { url: string }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
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
    </>
  );
}

interface ActiveLinkProps {
  plan: EventPlan;
  link: ShareLink;
  includeBudget: boolean;
  busy: Busy;
  run: Run;
}

/** A link that exists: when it expires, whether its copy is out of date, and turning it off. */
function ActiveLink({ plan, link, includeBudget, busy, run }: ActiveLinkProps) {
  const { t, f } = useI18n();
  // The shared copy is a snapshot: edits since, or a different budget choice, need a refresh.
  const outdated = link.revision !== plan.revision || link.includeBudget !== includeBudget;
  return (
    <>
      <LinkField url={shareUrl(link.id)} />
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
  );
}

function ShareDialog({ plan, onClose }: { plan: EventPlan; onClose: () => void }) {
  const { t } = useI18n();
  const link = useShareLinks((state) => state.links[plan.id]);
  const [includeBudget, setIncludeBudget] = useState(link?.includeBudget ?? true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const run: Run = async (kind, action, done) => {
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
        <ActiveLink plan={plan} link={link} includeBudget={includeBudget} busy={busy} run={run} />
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
