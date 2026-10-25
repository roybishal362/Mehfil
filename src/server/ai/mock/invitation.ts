/** Demo invitation drafts built from the brief. */
import type { InvitationDraft, InvitationRequest } from '../../../shared/schemas/ai';

export function mockInvitation(request: InvitationRequest): InvitationDraft {
  const { brief } = request;
  const hosts = request.hosts ? `${request.hosts} warmly invite` : 'We warmly invite';
  const when = `${brief.date}${brief.startTime ? ` at ${brief.startTime}` : ''}`;
  const where = request.venueName ? `${request.venueName}, ${brief.city}` : brief.city;
  return {
    variants: [
      {
        label: 'Warm',
        text: `${hosts} you to ${brief.title} on ${when} in ${where}. Your presence will make the day complete.`,
      },
      {
        label: 'Short',
        text: `You're invited! ${brief.title}, ${when}, ${where}. Please let us know if you can come.`,
      },
    ],
  };
}
