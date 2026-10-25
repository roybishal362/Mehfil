/** Step 1 of the form: what is being celebrated, when and where. */
import { EVENT_TYPES, VENUE_TYPES } from '../../../shared/schemas/primitives';
import { addDays, localToday } from '../../../shared/utils/dates';
import { Field } from '../../components/Field';
import { useI18n } from '../../i18n';
import { OccasionArt } from '../../motifs/OccasionArt';
import type { StepProps } from './step-props';

export function OccasionStep({ values, set, errorText }: StepProps) {
  const { t } = useI18n();
  const today = localToday();
  const typeError = errorText('type');

  return (
    <>
      <fieldset className="type-picker" aria-describedby={typeError ? 'type-error' : undefined}>
        <legend>{t.wizard.type}</legend>
        {EVENT_TYPES.map((type) => (
          <label key={type} className="type-option">
            <input
              type="radio"
              name="type"
              id={`type-${type}`}
              value={type}
              checked={values.type === type}
              onChange={() => {
                set('type', type);
              }}
            />
            <span>
              <OccasionArt kind={type} />
              {t.home.occasions[type].title}
            </span>
          </label>
        ))}
        {typeError && (
          <p className="error field" id="type-error">
            {typeError}
          </p>
        )}
      </fieldset>
      <Field
        id="title"
        label={t.wizard.titleLabel}
        hint={t.wizard.titleHint}
        error={errorText('title')}
      >
        {(control) => (
          <input
            {...control}
            className="input"
            maxLength={80}
            autoComplete="off"
            value={values.title}
            onChange={(event) => {
              set('title', event.target.value);
            }}
          />
        )}
      </Field>
      <div className="fields-2">
        <Field id="date" label={t.wizard.date} error={errorText('date')}>
          {(control) => (
            <input
              {...control}
              type="date"
              className="input"
              min={today}
              max={addDays(today, 3 * 365)}
              value={values.date}
              onChange={(event) => {
                set('date', event.target.value);
              }}
            />
          )}
        </Field>
        <Field
          id="endDate"
          label={t.wizard.endDate}
          extra={`(${t.common.optional})`}
          hint={t.wizard.endDateHint}
          error={errorText('endDate')}
        >
          {(control) => (
            <input
              {...control}
              type="date"
              className="input"
              min={values.date || today}
              value={values.endDate}
              onChange={(event) => {
                set('endDate', event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="city" label={t.wizard.city} error={errorText('city')}>
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={80}
              autoComplete="address-level2"
              value={values.city}
              onChange={(event) => {
                set('city', event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="startTime" label={t.wizard.startTime} extra={`(${t.common.optional})`}>
          {(control) => (
            <input
              {...control}
              type="time"
              className="input"
              value={values.startTime}
              onChange={(event) => {
                set('startTime', event.target.value);
              }}
            />
          )}
        </Field>
        <Field id="venueType" label={t.wizard.venueType}>
          {(control) => (
            <select
              {...control}
              className="select"
              value={values.venueType}
              onChange={(event) => {
                const venue = VENUE_TYPES.find((option) => option === event.target.value);
                if (venue) set('venueType', venue);
              }}
            >
              {VENUE_TYPES.map((venue) => (
                <option key={venue} value={venue}>
                  {t.venues[venue]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          id="subtype"
          label={t.wizard.subtype}
          extra={`(${t.common.optional})`}
          hint={t.wizard.subtypeHint}
        >
          {(control) => (
            <input
              {...control}
              className="input"
              maxLength={60}
              value={values.subtype}
              onChange={(event) => {
                set('subtype', event.target.value);
              }}
            />
          )}
        </Field>
      </div>
    </>
  );
}
