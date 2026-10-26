/** Adds a quote for a vendor: the business name, the amount quoted and a phone number. */
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import type { EventPlan, Vendor } from '../../../shared/schemas/plan';
import { parseAmount } from '../../../shared/utils/money';
import { toast } from '../../app/feedback';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n';
import { useEdit } from '../plan/use-edit';

export function QuoteForm({ plan, vendor }: { plan: EventPlan; vendor: Vendor }) {
  const { t } = useI18n();
  const edit = useEdit(plan.id);
  const [name, setName] = useState('');
  const [quote, setQuote] = useState('');
  const [phone, setPhone] = useState('');
  const prefix = `quote-${vendor.id}`;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The amount is optional, but if one is typed it must make sense ("2.5 lakh", "80k").
    const amount = quote.trim() ? parseAmount(quote) : null;
    if (!name.trim() || (quote.trim() && amount === null)) {
      toast(t.vendorsSection.quoteInvalid, { tone: 'error' });
      return;
    }
    const option = {
      name: name.trim(),
      ...(amount !== null ? { quote: amount } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    };
    if (edit({ type: 'vendor.addOption', vendorId: vendor.id, option })) {
      setName('');
      setQuote('');
      setPhone('');
    }
  };

  return (
    <form className="add-row" onSubmit={submit}>
      <TextField
        id={`${prefix}-name`}
        label={t.vendorsSection.vendorName}
        maxLength={80}
        autoComplete="organization"
        value={name}
        onChange={setName}
      />
      <TextField
        id={`${prefix}-amount`}
        label={t.vendorsSection.quote}
        inputMode="decimal"
        value={quote}
        onChange={setQuote}
      />
      <TextField
        id={`${prefix}-phone`}
        label={t.vendorsSection.phone}
        extra={`(${t.common.optional})`}
        type="tel"
        autoComplete="tel"
        maxLength={30}
        value={phone}
        onChange={setPhone}
      />
      <button type="submit" className="btn btn--ghost btn--sm">
        <Plus />
        {t.vendorsSection.addQuote}
      </button>
    </form>
  );
}
