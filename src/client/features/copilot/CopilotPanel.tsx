/**
 * The Copilot panel: a short conversation about the plan. Proposed changes are listed with
 * checkboxes and a before → after preview; nothing changes until the user applies them.
 */
import { Send } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { diffPlans } from '../../../shared/domain/diff';
import type { EventPlan } from '../../../shared/schemas/plan';
import { toast } from '../../app/feedback';
import { useI18n } from '../../i18n';
import { FLAME } from '../../photos';
import { plansStore } from '../../state/plans';
import {
  applyProposal,
  askCopilot,
  dismissProposal,
  previewProposal,
  selectedOperations,
  toggleProposal,
  useConversation,
} from './copilot';
import { describeChange, describeOperation } from './describe';

export function CopilotPanel({ plan }: { plan: EventPlan }) {
  const { t, f } = useI18n();
  const conversation = useConversation(plan.id);
  const [input, setInput] = useState('');
  const log = useRef<HTMLOListElement>(null);
  const { proposal } = conversation;
  const preview = proposal ? previewProposal(plan, proposal) : null;
  const changes = preview ? diffPlans(plan, preview) : [];
  const selectedCount = proposal ? selectedOperations(proposal).length : 0;

  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [conversation.messages.length, conversation.busy]);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || conversation.busy) return;
    setInput('');
    void askCopilot(plan.id, text);
  };

  const apply = () => {
    const applied = applyProposal(plan.id);
    if (applied === null) {
      toast(t.copilot.error, { tone: 'error' });
      return;
    }
    toast(t.copilot.applied(f.number(applied), applied), {
      action: {
        label: t.common.undo,
        run: () => {
          plansStore.getState().undo(plan.id);
        },
      },
    });
  };

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
              {message.text ||
                // An answer without words: say what came with it, so it is announced too.
                (message.proposed
                  ? t.copilot.proposed(f.number(message.proposed), message.proposed)
                  : t.copilot.noAnswer)}
            </li>
          ))}
          {conversation.busy && (
            <li className="bubble bubble--ai">
              <span className="spinner" aria-hidden="true" /> {t.copilot.thinking}
            </li>
          )}
        </ol>

        {conversation.messages.length === 0 && !conversation.busy && (
          <ul className="co-suggest" aria-label={t.overview.askTitle}>
            {t.overview.askSuggestions.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => {
                    void askCopilot(plan.id, question);
                  }}
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        )}

        {conversation.failed && (
          <p className="notice notice--danger" role="alert">
            {t.copilot.error}
          </p>
        )}

        {proposal && (
          <div className="grid gap-3">
            {proposal.operations.length > 0 && (
              <>
                <p className="text-ink-2">{t.copilot.review}</p>
                <ul className="proposals" aria-label={t.copilotOps.proposalsLabel}>
                  {proposal.operations.map((op, index) => {
                    const described = describeOperation(op, plan, t, f);
                    return (
                      // Proposals are fixed once received, so their index is a stable key.
                      <li key={index}>
                        <label>
                          <input
                            type="checkbox"
                            className="check"
                            checked={proposal.selected[index] ?? false}
                            onChange={() => {
                              toggleProposal(plan.id, index);
                            }}
                          />
                          <span>
                            <span className="what">{described.what}</span>
                            {described.detail && <span className="vals">{described.detail}</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {changes.length > 0 && (
              <details className="changes">
                <summary>{t.copilotOps.changesTitle}</summary>
                <ul className="legend">
                  {changes.map((change) => {
                    const described = describeChange(change, plan, t, f);
                    return (
                      <li key={`${change.kind}-${'id' in change ? change.id : described.what}`}>
                        <span>
                          {described.what}: {described.detail}
                        </span>
                        {described.delta !== undefined && described.delta !== 0 && (
                          <b
                            className={
                              described.delta > 0 ? 'delta delta--up' : 'delta delta--down'
                            }
                          >
                            {described.delta > 0 ? '+' : '−'}
                            {f.money(Math.abs(described.delta), plan.budget.currency)}
                          </b>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
            {proposal.dropped > 0 && (
              <p className="note">
                {t.copilot.dropped(f.number(proposal.dropped), proposal.dropped)}
              </p>
            )}
            <div className="co-actions">
              {proposal.operations.length > 0 && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={selectedCount === 0 || preview === null}
                  onClick={apply}
                >
                  {t.copilot.apply(f.number(selectedCount), selectedCount)}
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  dismissProposal(plan.id);
                }}
              >
                {t.common.dismiss}
              </button>
            </div>
          </div>
        )}

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
          <button type="submit" aria-label={t.copilot.send} disabled={conversation.busy}>
            <Send />
          </button>
        </form>
      </div>
    </aside>
  );
}
