/** Demo Copilot: understands a few common requests and proposes real plan edits. */
import type { CopilotRequest } from '../../../shared/schemas/ai';
import { addDays } from '../../../shared/utils/dates';
import { formatMoney, parseAmount } from '../../../shared/utils/money';
import type { ToolResponse } from '../provider';

/** Understands a few common requests so demo mode can show the Copilot proposing real edits. */
export function mockCopilot(request: CopilotRequest): ToolResponse {
  const message = request.message.toLowerCase();
  const guests = /(\d{1,4})\s*(more\s+)?(guests|people)/.exec(message);
  if (guests) {
    const value = Number(guests[1]);
    const guestCount = guests[2] ? request.brief.guestCount + value : value;
    return {
      text: `I'll plan for ${String(guestCount)} guests and keep the total budget the same by trimming flexible lines.`,
      calls: [
        { name: 'set_guest_count', args: { guestCount, keepBudget: true } },
        {
          name: 'add_task',
          args: {
            title: `Confirm the venue holds ${String(guestCount)} guests`,
            dueDate: addDays(request.today, 7),
            priority: 'high',
          },
        },
      ],
    };
  }
  const cut =
    /(?:cut|reduce|save|lower)\D{0,20}(\d[\d,.]*\s*(?:lakhs?|crores?|l|k|thousand)?)/.exec(message);
  const amount = cut?.[1] ? parseAmount(cut[1].trim().replace(/[.,]+$/, '')) : null;
  if (amount) {
    const protect = request.plan.budget.lines
      .filter((line) => /food|catering/i.test(line.name) && /food|catering/.test(message))
      .map((line) => line.id);
    return {
      text: `Here is a version ${formatMoney(amount, request.brief.currency)} lower${protect.length ? ' that leaves food untouched' : ''}.`,
      calls: [
        {
          name: 'set_budget_total',
          args: {
            total: Math.max(1000, request.plan.budget.total - amount),
            protectLineIds: protect,
          },
        },
      ],
    };
  }
  const add = /add (?:a )?task:?\s+(.+)/i.exec(request.message);
  if (add?.[1]) {
    // Like Gemini often does, a direct instruction is answered with the change alone.
    return {
      text: '',
      calls: [
        {
          name: 'add_task',
          args: { title: add[1].trim(), dueDate: addDays(request.today, 7), priority: 'medium' },
        },
      ],
    };
  }
  const next = request.plan.tasks
    .filter((t) => t.status !== 'done')
    .slice(0, 3)
    .map((t) => t.title);
  return {
    text: next.length
      ? `This week, focus on: ${next.join('; ')}.`
      : 'Everything on your list is done. Enjoy the celebration!',
    calls: [],
  };
}
