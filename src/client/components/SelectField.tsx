/**
 * A labelled select for one of a fixed list of values. The value from the DOM is matched back
 * to the list, so `onChange` only ever receives a value of the right type.
 */
import type { OptionHTMLAttributes } from 'react';
import { Field } from './Field';

export interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  /** The visible name of each option. */
  labelOf: (option: T) => string;
  onChange: (value: T) => void;
  /** Extra attributes per option, e.g. `lang` for language names in their own script. */
  optionProps?: (option: T) => OptionHTMLAttributes<HTMLOptionElement>;
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  labelOf,
  onChange,
  optionProps,
}: SelectFieldProps<T>) {
  return (
    <Field id={id} label={label}>
      {(control) => (
        <select
          {...control}
          className="select"
          value={value}
          onChange={(event) => {
            const next = options.find((option) => option === event.target.value);
            if (next) onChange(next);
          }}
        >
          {options.map((option) => (
            <option key={option} value={option} {...optionProps?.(option)}>
              {labelOf(option)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
