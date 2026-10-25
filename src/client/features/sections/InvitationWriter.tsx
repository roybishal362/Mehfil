/**
 * The invitation writer: Gemini drafts invitations in the chosen tone, channel and language.
 * It sends only the event brief and optional host and venue names, never the guest list.
 */
import { Copy, MessageCircle, Sparkles } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { whatsAppLink } from '../../../shared/export/links';
import {
  INVITATION_CHANNELS,
  INVITATION_TONES,
  InvitationApiResponse,
  type InvitationDraft,
} from '../../../shared/schemas/ai';
import type { EventPlan } from '../../../shared/schemas/plan';
import { OUTPUT_LANGUAGES, type OutputLanguage } from '../../../shared/schemas/primitives';
import { toast } from '../../app/feedback';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { postJson } from '../../lib/api';
import { LANGUAGE_ENDONYMS } from '../new-plan/wizard-model';

type Tone = (typeof INVITATION_TONES)[number];
type Channel = (typeof INVITATION_CHANNELS)[number];

export function InvitationWriter({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const [tone, setTone] = useState<Tone>('warm');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [language, setLanguage] = useState<OutputLanguage>(plan.brief.language);
  const [hosts, setHosts] = useState('');
  const [venueName, setVenueName] = useState('');
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<InvitationDraft['variants']>([]);

  const write = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await postJson(
        '/api/ai/invitation',
        {
          brief: plan.brief,
          tone,
          channel,
          language,
          ...(hosts.trim() ? { hosts: hosts.trim() } : {}),
          ...(venueName.trim() ? { venueName: venueName.trim() } : {}),
        },
        InvitationApiResponse,
      );
      setVariants(response.variants);
    } catch {
      toast(t.guestsSection.writeError, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t.common.copied);
    } catch {
      toast(t.guestsSection.copyFailed, { tone: 'error' });
    }
  };

  return (
    <form className="card grid gap-4" onSubmit={(event) => void write(event)}>
      <header className="card-head">
        <span className="badge">
          <Sparkles />
        </span>
        <h3>{t.guestsSection.writerTitle}</h3>
      </header>
      <p className="text-ink-2">{t.guestsSection.writerIntro}</p>
      <div className="fields-2">
        <Field id="invite-tone" label={t.guestsSection.tone}>
          {(control) => (
            <select
              {...control}
              className="select"
              value={tone}
              onChange={(event) => {
                const next = INVITATION_TONES.find((value) => value === event.target.value);
                if (next) setTone(next);
              }}
            >
              {INVITATION_TONES.map((value) => (
                <option key={value} value={value}>
                  {t.guestsSection.tones[value]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="invite-channel" label={t.guestsSection.channel}>
          {(control) => (
            <select
              {...control}
              className="select"
              value={channel}
              onChange={(event) => {
                const next = INVITATION_CHANNELS.find((value) => value === event.target.value);
                if (next) setChannel(next);
              }}
            >
              {INVITATION_CHANNELS.map((value) => (
                <option key={value} value={value}>
                  {t.guestsSection.channels[value]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="invite-language" label={t.guestsSection.language}>
          {(control) => (
            <select
              {...control}
              className="select"
              value={language}
              onChange={(event) => {
                const next = OUTPUT_LANGUAGES.find((value) => value === event.target.value);
                if (next) setLanguage(next);
              }}
            >
              {OUTPUT_LANGUAGES.map((code) => (
                <option key={code} value={code} {...writtenIn(code)}>
                  {LANGUAGE_ENDONYMS[code]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="invite-hosts" label={t.guestsSection.hosts} extra={`(${t.common.optional})`}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={120}
              value={hosts}
              onChange={(event) => {
                setHosts(event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="invite-venue" label={t.guestsSection.venueName} extra={`(${t.common.optional})`}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={120}
              value={venueName}
              onChange={(event) => {
                setVenueName(event.target.value);
              }}
            />
          )}
        </Field>
      </div>
      <button type="submit" className="btn btn--primary justify-self-start" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Sparkles />}
        {busy ? t.guestsSection.writing : t.guestsSection.write}
      </button>
      {variants.length > 0 && (
        <ul className="variants" aria-live="polite">
          {variants.map((variant) => (
            <li key={variant.label} className="variant">
              <h4>{variant.label}</h4>
              <p {...writtenIn(language)}>{variant.text}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void copy(variant.text)}
                >
                  <Copy />
                  {t.common.copy}
                  <span className="sr-only">: {variant.label}</span>
                </button>
                {channel === 'whatsapp' && (
                  <a
                    className="btn btn--ghost btn--sm"
                    href={whatsAppLink(variant.text)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle />
                    {t.guestsSection.whatsapp}
                    <span className="sr-only"> {t.vendorsSection.newTab}</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
