/** Step 3 of the form: style, diets, traditions, accessibility, language and notes. */
import { DIETARY_NEEDS, OUTPUT_LANGUAGES } from '../../../shared/schemas/primitives';
import { Field } from '../../components/Field';
import { SelectField } from '../../components/SelectField';
import { useI18n } from '../../i18n';
import { writtenIn } from '../../i18n/written-in';
import { ChoiceGroup, toggled, WizardInput } from './fields';
import type { StepProps } from './step-props';
import { LANGUAGE_ENDONYMS, STYLE_KEYS } from './wizard-model';

export function TouchesStep({ values, set }: Pick<StepProps, 'values' | 'set'>) {
  const { t } = useI18n();
  const bound = { values, set };
  return (
    <>
      <ChoiceGroup
        legend={t.wizard.stylesLegend}
        options={STYLE_KEYS}
        chosen={values.styles}
        labelOf={(style) => t.styles[style]}
        onToggle={(style) => {
          set('styles', toggled(values.styles, style));
        }}
      />
      <ChoiceGroup
        legend={t.wizard.dietaryLegend}
        options={DIETARY_NEEDS}
        chosen={values.dietary}
        labelOf={(need) => t.dietary[need]}
        onToggle={(need) => {
          set('dietary', toggled(values.dietary, need));
        }}
      />
      <WizardInput
        {...bound}
        field="traditions"
        optional
        label={t.wizard.traditions}
        hint={t.wizard.traditionsHint}
        maxLength={200}
      />
      <div className="fields-2">
        <WizardInput
          {...bound}
          field="accessibility"
          optional
          label={t.wizard.accessibility}
          hint={t.wizard.accessibilityHint}
          maxLength={200}
        />
        <SelectField
          id="language"
          label={t.wizard.language}
          value={values.language}
          options={OUTPUT_LANGUAGES}
          labelOf={(code) => LANGUAGE_ENDONYMS[code]}
          onChange={(language) => {
            set('language', language);
          }}
          optionProps={writtenIn}
        />
      </div>
      <Field id="notes" label={t.wizard.notes} extra={`(${t.common.optional})`}>
        {(control) => (
          <textarea
            {...control}
            className="textarea"
            maxLength={500}
            rows={3}
            value={values.notes}
            onChange={(event) => {
              set('notes', event.target.value);
            }}
          />
        )}
      </Field>
    </>
  );
}
