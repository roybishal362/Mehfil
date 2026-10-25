/** Step 3 of the form: style, diets, traditions, accessibility, language and notes. */
import { DIETARY_NEEDS, OUTPUT_LANGUAGES } from '../../../shared/schemas/primitives';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import type { StepProps } from './step-props';
import { LANGUAGE_ENDONYMS, STYLE_KEYS, type WizardValues } from './wizard-model';

export function TouchesStep({ values, set }: Pick<StepProps, 'values' | 'set'>) {
  const { t } = useI18n();

  const toggle = <K extends 'styles' | 'dietary'>(field: K, item: WizardValues[K][number]) => {
    const list = values[field] as readonly string[];
    const next = list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
    set(field, next as WizardValues[K]);
  };

  return (
    <>
      <fieldset className="field options">
        <legend className="label">{t.wizard.stylesLegend}</legend>
        {STYLE_KEYS.map((style) => (
          <label key={style} className="option">
            <input
              type="checkbox"
              checked={values.styles.includes(style)}
              onChange={() => {
                toggle('styles', style);
              }}
            />
            <span>{t.styles[style]}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="field options">
        <legend className="label">{t.wizard.dietaryLegend}</legend>
        {DIETARY_NEEDS.map((need) => (
          <label key={need} className="option">
            <input
              type="checkbox"
              checked={values.dietary.includes(need)}
              onChange={() => {
                toggle('dietary', need);
              }}
            />
            <span>{t.dietary[need]}</span>
          </label>
        ))}
      </fieldset>
      <Field
        id="traditions"
        label={t.wizard.traditions}
        extra={`(${t.common.optional})`}
        hint={t.wizard.traditionsHint}
      >
        {(control) => (
          <input
            {...control}
            className="input"
            maxLength={200}
            value={values.traditions}
            onChange={(event) => {
              set('traditions', event.target.value);
            }}
          />
        )}
      </Field>
      <div className="fields-2">
        <Field
          id="accessibility"
          label={t.wizard.accessibility}
          extra={`(${t.common.optional})`}
          hint={t.wizard.accessibilityHint}
        >
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={200}
              value={values.accessibility}
              onChange={(event) => {
                set('accessibility', event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="language" label={t.wizard.language}>
          {(control) => (
            <select
              {...control}
              className="select"
              value={values.language}
              onChange={(event) => {
                const language = OUTPUT_LANGUAGES.find((code) => code === event.target.value);
                if (language) set('language', language);
              }}
            >
              {OUTPUT_LANGUAGES.map((code) => (
                <option key={code} value={code} lang={code}>
                  {LANGUAGE_ENDONYMS[code]}
                </option>
              ))}
            </select>
          )}
        </Field>
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
