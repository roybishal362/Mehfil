/** Step 2 of the form: how many guests, and how much to spend in which currency. */
import { CURRENCIES } from '../../../shared/schemas/primitives';
import { parseAmount } from '../../../shared/utils/money';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import type { StepProps } from './step-props';

/** "INR (₹)": the code, with its symbol when the symbol differs from the code. */
function currencyLabel(code: string): string {
  const symbol = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value;
  return symbol && symbol !== code ? `${code} (${symbol})` : code;
}

export function GuestsBudgetStep({ values, set, errorText }: StepProps) {
  const { t, f } = useI18n();
  // Shows how "18 lakh" or "1.5 crore" was read, so typos are caught before the plan is made.
  const parsedBudget = parseAmount(values.budget);

  return (
    <div className="fields-2">
      <Field id="guestCount" label={t.wizard.guestCount} error={errorText('guestCount')}>
        {(control) => (
          <input
            {...control}
            type="number"
            inputMode="numeric"
            className="input"
            min={1}
            max={5000}
            value={values.guestCount}
            onChange={(event) => {
              set('guestCount', event.target.value);
            }}
          />
        )}
      </Field>
      <Field
        id="budget"
        label={t.wizard.budget}
        hint={
          parsedBudget !== null
            ? `${t.wizard.budgetHint} = ${f.money(parsedBudget, values.currency)}`
            : t.wizard.budgetHint
        }
        error={errorText('budget')}
      >
        {(control) => (
          <input
            {...control}
            className="input"
            inputMode="decimal"
            autoComplete="off"
            value={values.budget}
            onChange={(event) => {
              set('budget', event.target.value);
            }}
          />
        )}
      </Field>
      <Field id="currency" label={t.wizard.currency}>
        {(control) => (
          <select
            {...control}
            className="select"
            value={values.currency}
            onChange={(event) => {
              const currency = CURRENCIES.find((code) => code === event.target.value);
              if (currency) set('currency', currency);
            }}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabel(code)}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}
