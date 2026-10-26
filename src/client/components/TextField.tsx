/**
 * A labelled text-like input (text, number, date, time, tel). Field wires up the label, hint
 * and error; `onChange` receives the new text.
 */
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Field } from './Field';

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'value' | 'onChange'
> {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | undefined;
  /** Shown after the label, e.g. "(optional)". */
  extra?: ReactNode;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  extra,
  className = 'input',
  ...input
}: TextFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} extra={extra}>
      {(control) => (
        <input
          {...control}
          className={className}
          {...input}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </Field>
  );
}
