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
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { postJson } from '../../lib/api';
import { LANGUAGE_ENDONYMS } from '../new-plan/wizard-model';

type Tone = (typeof INVITATION_TONES)[number];
type Channel = (typeof INVITATION_CHANNELS)[number];
type Variant = InvitationDraft['variants'][number];

/** Each drafted invitation, with Copy and (for WhatsApp) a link that opens it ready to send. */
function Variants({
  variants,
  channel,
  language,
}: {
  variants: readonly Variant[];
  channel: Channel;
  language: OutputLanguage;
}) {
  const { t } = useI18n();
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t.common.copied);
    } catch {
      toast(t.guestsSection.copyFailed, { tone: 'error' });
    }
  };
  return (
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
  );
}

interface Choices {
  tone: Tone;
  channel: Channel;
  language: OutputLanguage;
  hosts: string;
  venueName: string;
}

type Update = <K extends keyof Choices>(key: K) => (value: Choices[K]) => void;

/** What Gemini is sent: the brief and the choices, leaving out names that were not filled in. */
function invitationRequest(plan: EventPlan, { hosts, venueName, ...choices }: Choices) {
  return {
    brief: plan.brief,
    ...choices,
    ...(hosts.trim() ? { hosts: hosts.trim() } : {}),
    ...(venueName.trim() ? { venueName: venueName.trim() } : {}),
  };
}

/** Tone, channel and language, and the optional host and venue names. */
function InvitationOptions({ choices, update }: { choices: Choices; update: Update }) {
  const { t } = useI18n();
  return (
    <div className="fields-2">
      <SelectField
        id="invite-tone"
        label={t.guestsSection.tone}
        value={choices.tone}
        options={INVITATION_TONES}
        labelOf={(value) => t.guestsSection.tones[value]}
        onChange={update('tone')}
      />
      <SelectField
        id="invite-channel"
        label={t.guestsSection.channel}
        value={choices.channel}
        options={INVITATION_CHANNELS}
        labelOf={(value) => t.guestsSection.channels[value]}
        onChange={update('channel')}
      />
      <SelectField
        id="invite-language"
        label={t.guestsSection.language}
        value={choices.language}
        options={OUTPUT_LANGUAGES}
        labelOf={(code) => LANGUAGE_ENDONYMS[code]}
        onChange={update('language')}
        optionProps={writtenIn}
      />
      <TextField
        id="invite-hosts"
        label={t.guestsSection.hosts}
        extra={`(${t.common.optional})`}
        maxLength={120}
        value={choices.hosts}
        onChange={update('hosts')}
      />
      <TextField
        id="invite-venue"
        label={t.guestsSection.venueName}
        extra={`(${t.common.optional})`}
        maxLength={120}
        value={choices.venueName}
        onChange={update('venueName')}
      />
    </div>
  );
}

/** Asks Gemini for the drafts; a failure leaves the last drafts in place and says so. */
function useInvitationDrafts(plan: EventPlan) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<readonly Variant[]>([]);
  const write = async (choices: Choices) => {
    setBusy(true);
    try {
      const request = invitationRequest(plan, choices);
      setVariants((await postJson('/api/ai/invitation', request, InvitationApiResponse)).variants);
    } catch {
      toast(t.guestsSection.writeError, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return { busy, variants, write };
}

export function InvitationWriter({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const [choices, setChoices] = useState<Choices>(() => ({
    tone: 'warm',
    channel: 'whatsapp',
    language: plan.brief.language,
    hosts: '',
    venueName: '',
  }));
  const { busy, variants, write } = useInvitationDrafts(plan);
  const update: Update = (key) => (value) => {
    setChoices((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void write(choices);
  };

  return (
    <form className="card grid gap-4" onSubmit={submit}>
      <header className="card-head">
        <span className="badge">
          <Sparkles />
        </span>
        <h3>{t.guestsSection.writerTitle}</h3>
      </header>
      <p className="text-ink-2">{t.guestsSection.writerIntro}</p>
      <InvitationOptions choices={choices} update={update} />
      <button type="submit" className="btn btn--primary justify-self-start" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Sparkles />}
        {busy ? t.guestsSection.writing : t.guestsSection.write}
      </button>
      {variants.length > 0 && (
        <Variants variants={variants} channel={choices.channel} language={choices.language} />
      )}
    </form>
  );
}
