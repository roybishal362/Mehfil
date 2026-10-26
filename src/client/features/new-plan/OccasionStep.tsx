/** Step 1 of the form: what is being celebrated, when and where. */
import type { Mood } from '../../../shared/domain/mood';
import { EVENT_TYPES, VENUE_TYPES, type EventType } from '../../../shared/schemas/primitives';
import { addDays, localToday } from '../../../shared/utils/dates';
import { SelectField } from '../../components/SelectField';
import { useI18n } from '../../i18n';
import { archPhoto } from '../../photos';
import { Arch } from '../../photos/Arch';
import { Photo } from '../../photos/Photo';
import { WizardInput } from './fields';
import type { StepProps } from './step-props';

/** Each type of celebration shows the photograph of the look it starts with. */
const TYPE_PHOTO: Readonly<Record<EventType, Mood>> = {
  wedding: 'wedding',
  birthday: 'birthday',
  community: 'utsav',
  other: 'neutral',
};

function TypePicker({
  value,
  onChange,
  error,
}: {
  value: EventType | '';
  onChange: (type: EventType) => void;
  error: string | undefined;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="type-picker" aria-describedby={error ? 'type-error' : undefined}>
      <legend>{t.wizard.type}</legend>
      {EVENT_TYPES.map((type) => (
        <label key={type} className="type-option">
          <input
            type="radio"
            name="type"
            id={`type-${type}`}
            value={type}
            checked={value === type}
            onChange={() => {
              onChange(type);
            }}
          />
          <span>
            <Arch>
              <Photo photo={archPhoto(TYPE_PHOTO[type])} sizes="56px" />
            </Arch>
            {t.home.occasions[type].title}
          </span>
        </label>
      ))}
      {error && (
        <p className="error field" id="type-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function OccasionStep({ values, set, errorText }: StepProps) {
  const { t } = useI18n();
  const today = localToday();
  const bound = { values, set };
  return (
    <>
      <TypePicker
        value={values.type}
        onChange={(type) => {
          set('type', type);
        }}
        error={errorText('type')}
      />
      <WizardInput
        {...bound}
        field="title"
        label={t.wizard.titleLabel}
        hint={t.wizard.titleHint}
        error={errorText('title')}
        maxLength={80}
        autoComplete="off"
      />
      <div className="fields-2">
        <WizardInput
          {...bound}
          field="date"
          type="date"
          label={t.wizard.date}
          error={errorText('date')}
          min={today}
          max={addDays(today, 3 * 365)}
        />
        <WizardInput
          {...bound}
          field="endDate"
          type="date"
          optional
          label={t.wizard.endDate}
          hint={t.wizard.endDateHint}
          error={errorText('endDate')}
          min={values.date || today}
        />
        <WizardInput
          {...bound}
          field="city"
          label={t.wizard.city}
          error={errorText('city')}
          maxLength={80}
          autoComplete="address-level2"
        />
        <WizardInput {...bound} field="startTime" type="time" optional label={t.wizard.startTime} />
        <SelectField
          id="venueType"
          label={t.wizard.venueType}
          value={values.venueType}
          options={VENUE_TYPES}
          labelOf={(venue) => t.venues[venue]}
          onChange={(venue) => {
            set('venueType', venue);
          }}
        />
        <WizardInput
          {...bound}
          field="subtype"
          optional
          label={t.wizard.subtype}
          hint={t.wizard.subtypeHint}
          maxLength={60}
        />
      </div>
    </>
  );
}
