import type { WizardField, WizardValues } from './wizard-model';

/** What each step of the form gets from the page: the values, a setter and field errors. */
export interface StepProps {
  values: WizardValues;
  set: <K extends WizardField>(field: K, value: WizardValues[K]) => void;
  /** The translated error for a field, when it has one. */
  errorText: (field: WizardField) => string | undefined;
}
