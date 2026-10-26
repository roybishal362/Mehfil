/**
 * The Copilot panel: a short conversation about the plan. Proposed changes are listed with
 * checkboxes and a before → after preview; nothing changes until the user applies them.
 */
import { Send } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import type { EventPlan } from '../../../shared/schemas/plan';
import { useI18n } from '../../i18n';
import { FLAME } from '../../photos';
import { askCopilot, useConversation, type ChatMessage, type Conversation } from './copilot';
import { ProposalReview } from './ProposalReview';

/** A message's text; an answer without words says what came with it, so it is announced too. */
function useMessageText(): (message: ChatMessage) => string {
  const { t, f } = useI18n();
  return (message) =>
    message.text ||
    (message.proposed
      ? t.copilot.proposed(f.number(message.proposed), message.proposed)
      : t.copilot.noAnswer);
}

/** The conversation so far, kept scrolled to the newest message and read out as it grows. */
function ConversationLog({ conversation }: { conversation: Conversation }) {
  const { t } = useI18n();
  const textOf = useMessageText();
  const log = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [conversation.messages.length, conversation.busy]);

  return (
    <ol className="co-log" ref={log} aria-live="polite" aria-relevant="additions">
      {conversation.messages.length === 0 && (
        <li className="bubble bubble--ai">{t.copilot.empty}</li>
      )}
      {conversation.messages.map((message, index) => (
        <li
          // Messages are append-only, so their position is a stable key.
          key={index}
          className={message.role === 'user' ? 'bubble bubble--me' : 'bubble bubble--ai'}
        >
          <span className="sr-only">
            {message.role === 'user' ? t.copilot.you : t.copilot.mehfil}:{' '}
          </span>
          {textOf(message)}
        </li>
      ))}
      {conversation.busy && (
        <li className="bubble bubble--ai">
          <span className="spinner" aria-hidden="true" /> {t.copilot.thinking}
        </li>
      )}
    </ol>
  );
}

/** Ready-made questions for an empty conversation. */
function Suggestions({ planId }: { planId: string }) {
  const { t } = useI18n();
  return (
    <ul className="co-suggest" aria-label={t.overview.askTitle}>
      {t.overview.askSuggestions.map((question) => (
        <li key={question}>
          <button
            type="button"
            onClick={() => {
              void askCopilot(planId, question);
            }}
          >
            {question}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Composer({ planId, busy }: { planId: string; busy: boolean }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void askCopilot(planId, text);
  };

  return (
    <form className="composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="copilot-input">
        {t.copilot.label}
      </label>
      <input
        id="copilot-input"
        className="input"
        autoComplete="off"
        maxLength={600}
        placeholder={t.copilot.placeholder}
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
        }}
      />
      <button type="submit" aria-label={t.copilot.send} disabled={busy}>
        <Send />
      </button>
    </form>
  );
}

export function CopilotPanel({ plan }: { plan: EventPlan }) {
  const { t } = useI18n();
  const conversation = useConversation(plan.id);
  const fresh = conversation.messages.length === 0 && !conversation.busy;
  return (
    <aside className="copilot" id="copilot" aria-labelledby="copilot-title">
      <div className="co-head">
        <h2 id="copilot-title">
          <img className="co-mark" src={FLAME} width={36} height={36} alt="" />
          {t.copilot.title}
        </h2>
        <p>{t.copilot.subtitle}</p>
      </div>
      <div className="co-body">
        <ConversationLog conversation={conversation} />
        {fresh && <Suggestions planId={plan.id} />}
        {conversation.failed && (
          <p className="notice notice--danger" role="alert">
            {t.copilot.error}
          </p>
        )}
        {conversation.proposal && <ProposalReview plan={plan} proposal={conversation.proposal} />}
        <Composer planId={plan.id} busy={conversation.busy} />
      </div>
    </aside>
  );
}
