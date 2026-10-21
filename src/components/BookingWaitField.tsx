import { useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import type { BookingWaitState } from './BookingWaitPicker';

export interface BookingWaitFieldProps {
  /** The host's wait as BookingWaitAdapter.load() reads it: their own, the standard, their limit. */
  state: BookingWaitState;
  /** The wait for this one booker, in minutes; null = it follows the host's usual wait. */
  value: number | null;
  /**
   * Called on every edit. `minutes` is null when the hours equal the host's usual wait (so the
   * booker keeps following it) or when the hours are not valid; `valid` says which.
   */
  onChange: (minutes: number | null, valid: boolean) => void;
  /** The field's label, in the product's words. Defaults to labels.waitCaseHours. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

const hoursOf = (minutes: number) => Math.round(minutes / 60);

/**
 * The hours input both wait components share: a whole number of hours from 0 to the host's limit.
 */
export function WaitHoursInput({
  id,
  label,
  hours,
  maxHours,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hours: string;
  maxHours: number;
  disabled?: boolean;
  onChange: (hours: string) => void;
}) {
  const { labels } = useCalendarUi();

  return (
    <div className="cal-policy__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="cal-input"
        type="number"
        min={0}
        max={maxHours}
        inputMode="numeric"
        aria-describedby={`${id}-max`}
        value={hours}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="cal-policy__hint" id={`${id}-max`}>{labels.waitRange(maxHours)}</span>
    </div>
  );
}

/** Whether `hours` is a whole number of hours within the limit. */
export function validWaitHours(hours: string, maxHours: number): boolean {
  const n = Number(hours);

  return hours !== '' && Number.isInteger(n) && n >= 0 && n <= maxHours;
}

/**
 * The wait for ONE booker, chosen where the product sets that booker up (Portify: the first-call
 * setup when a consultant accepts a case). It starts at the host's usual wait (their own, else the
 * standard) and may be changed for this booker only, up to the host's limit. Controlled: the
 * product saves it with the rest of its form, and reports it to calendar-service with the event
 * (`since` {at, wait}). To start over from new props, give it a new `key`.
 */
export function BookingWaitField({ state, value, onChange, label, disabled, className }: BookingWaitFieldProps) {
  const { labels } = useCalendarUi();
  const id = useId();
  const usual = state.own ?? state.standard;
  const maxHours = Math.floor(state.max / 60);
  const [hours, setHours] = useState(String(hoursOf(value ?? usual)));

  const change = (next: string) => {
    setHours(next);
    const valid = validWaitHours(next, maxHours);
    const minutes = Number(next) * 60;
    onChange(valid && minutes !== usual ? minutes : null, valid);
  };

  const differs = validWaitHours(hours, maxHours) && Number(hours) * 60 !== usual;

  return (
    <div className={cx('cal-wait__body', 'cal-wait-field', className)}>
      <p className="cal-policy__hint">{labels.waitCaseUsual(hoursOf(usual), state.own !== null)}</p>
      <WaitHoursInput id={id} label={label ?? labels.waitCaseHours} hours={hours} maxHours={maxHours} disabled={disabled} onChange={change} />
      {differs ? (
        <p className="cal-policy__note" role="status">
          {labels.waitCaseDiffers}{' '}
          <button
            type="button"
            className="cal-wait-field__reset"
            disabled={disabled}
            onClick={() => change(String(hoursOf(usual)))}
          >
            {labels.waitCaseReset(hoursOf(usual))}
          </button>
        </p>
      ) : null}
    </div>
  );
}
