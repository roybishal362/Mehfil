/** Inputs bound to the step-by-step form's values, so each step reads as a list of questions. */
import { TextField, type TextFieldProps } from '../../components/TextField';
import { useI18n } from '../../i18n';
import type { StepProps } from './step-props';

/** The form's free-text fields (dates and times included: inputs hold them as text). */
type TextKey =
  'title' | 'date' | 'endDate' | 'startTime' | 'city' | 'subtype' | 'traditions' | 'accessibility';

interface WizardInputProps
  extends
    Omit<TextFieldProps, 'id' | 'value' | 'onChange' | 'extra'>,
    Pick<StepProps, 'values' | 'set'> {
  field: TextKey;
  /** Shows "(optional)" after the label. */
  optional?: boolean;
}

export function WizardInput({ field, optional = false, values, set, ...rest }: WizardInputProps) {
  const { t } = useI18n();
  return (
    <TextField
      id={field}
      extra={optional ? `(${t.common.optional})` : undefined}
      {...rest}
      value={values[field]}
      onChange={(value) => {
        set(field, value);
      }}
    />
  );
}

/** A list with the item added, or taken out if it was already there. */
export function toggled<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

/** Checkboxes for picking any number of options from a fixed list. */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  chosen,
  labelOf,
  onToggle,
}: {
  legend: string;
  options: readonly T[];
  chosen: readonly T[];
  labelOf: (option: T) => string;
  onToggle: (option: T) => void;
}) {
  return (
    <fieldset className="field options">
      <legend className="label">{legend}</legend>
      {options.map((option) => (
        <label key={option} className="option">
          <input
            type="checkbox"
            checked={chosen.includes(option)}
            onChange={() => {
              onToggle(option);
            }}
          />
          <span>{labelOf(option)}</span>
        </label>
      ))}
    </fieldset>
  );
}
