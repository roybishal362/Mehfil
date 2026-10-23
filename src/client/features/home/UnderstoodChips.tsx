/** Live chips showing what Mehfil understood from the description so far. */
import { CalendarDays, Leaf, MapPin, PartyPopper, Users, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { QuickParse } from '../../../shared/domain/quick-parse';
import { useI18n } from '../../i18n';

export function UnderstoodChips({ parsed }: { parsed: QuickParse }) {
  const { t, f } = useI18n();
  const chips: { key: string; icon: ReactNode; text: string }[] = [];
  if (parsed.type) chips.push({ key: 'type', icon: <PartyPopper />, text: t.types[parsed.type] });
  if (parsed.city) chips.push({ key: 'city', icon: <MapPin />, text: parsed.city });
  if (parsed.date)
    chips.push({ key: 'date', icon: <CalendarDays />, text: f.dateLong(parsed.date) });
  if (parsed.guestCount !== undefined) {
    chips.push({
      key: 'guests',
      icon: <Users />,
      text: t.chips.guests(f.number(parsed.guestCount), parsed.guestCount),
    });
  }
  if (parsed.budget !== undefined) {
    chips.push({
      key: 'budget',
      icon: <Wallet />,
      text: f.money(parsed.budget, parsed.currency ?? 'INR'),
    });
  }
  if (parsed.dietary.length > 0) {
    chips.push({
      key: 'dietary',
      icon: <Leaf />,
      text: f.list(parsed.dietary.map((need) => t.dietary[need])),
    });
  }

  return (
    <div className="understood">
      <span className="lbl" id="understood-label">
        {t.home.understood}
      </span>
      {chips.length === 0 ? (
        <span className="hint">{t.home.understoodNothing}</span>
      ) : (
        <ul className="understood-list" aria-labelledby="understood-label">
          {chips.map((chip) => (
            <li key={`${chip.key}:${chip.text}`} className="chip">
              {chip.icon}
              {chip.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
