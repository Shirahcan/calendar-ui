import { useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';
import { WaitHoursInput, validWaitHours } from './BookingWaitField';

/** A host's wait after one reported event (calendar-service host preference `wait_after`). */
export interface BookingWaitState {
  /** The host's own wait in minutes; null = the standard wait applies. */
  own: number | null;
  /** The product's standard wait in minutes (the policy's `wait_after`). */
  standard: number;
  /** The most this host may choose, in minutes (their limit, else the service's bound). */
  max: number;
}

/** The product's own backend, which calls calendar-service (the package never calls the service). */
export interface BookingWaitAdapter {
  load: () => Promise<BookingWaitState>;
  /** null = follow the standard wait again. The service refuses a value above the host's limit. */
  save: (minutes: number | null) => Promise<BookingWaitState>;
}

export interface BookingWaitPickerProps {
  adapter: BookingWaitAdapter;
  /** What the wait follows, in the product's words: "Time before a new client's first call". */
  title: string;
  /** Why it helps and who it applies to. */
  hint?: string;
  describeError?: (error: unknown) => string;
  className?: string;
}

const hoursOf = (minutes: number) => Math.round(minutes / 60);

/**
 * How long after an event a host's times stay closed to the person it happened to, e.g. a day
 * after a consultant accepts a case so they can read the file first. Only the times inside the
 * wait are left out; the person can still book every later time. The host follows the product's
 * standard wait or sets their own, up to their limit.
 */
export function BookingWaitPicker({ adapter, title, hint, describeError, className }: BookingWaitPickerProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [state, setState] = useState<BookingWaitState | null>(null);
  const [own, setOwn] = useState(false);
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.waitFailed));

  const adopt = (s: BookingWaitState) => {
    setState(s);
    setOwn(s.own !== null);
    setHours(String(hoursOf(s.own ?? s.standard)));
  };

  useEffect(() => {
    let live = true;
    adapter.load().then((s) => live && adopt(s)).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adapter]);

  const maxHours = state ? Math.floor(state.max / 60) : 0;
  const valid = !own || validWaitHours(hours, maxHours);
  const next = own ? Number(hours) * 60 : null;
  const dirty = state !== null && next !== state.own;

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      adopt(await adapter.save(next));
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);

  return (
    <section className={cx('cal-tools', 'cal-wait', className)} aria-labelledby={`${ids}-t`}>
      <h3 className="cal-tools__title" id={`${ids}-t`}>{title}</h3>
      {hint ? <p className="cal-tools__intro">{hint}</p> : null}
      {state === null && !error ? <p className="cal-tools__intro">{labels.waitLoading}</p> : null}

      {state !== null ? (
        <div className="cal-wait__body">
          <div className="cal-wait__choices" role="radiogroup" aria-labelledby={`${ids}-t`}>
            <label className="cal-policy__check">
              <input type="radio" name={`${ids}-mode`} checked={!own} disabled={busy} onChange={() => { setOwn(false); setSaved(false); }} />
              {labels.waitStandard(hoursOf(state.standard))}
            </label>
            <label className="cal-policy__check">
              <input type="radio" name={`${ids}-mode`} checked={own} disabled={busy} onChange={() => { setOwn(true); setSaved(false); }} />
              {labels.waitOwn}
            </label>
          </div>
          {own ? (
            <WaitHoursInput
              id={`${ids}-h`}
              label={labels.waitHours}
              hours={hours}
              maxHours={maxHours}
              disabled={busy}
              onChange={(h) => { setHours(h); setSaved(false); }}
            />
          ) : null}
          <div className="cal-policy__actions">
            <button type="button" className={primary} disabled={busy || !dirty || !valid} onClick={() => void save()}>{labels.waitSave}</button>
            {saved && !dirty ? <span className="cal-policy__note" role="status">{labels.waitSaved}</span> : null}
          </div>
        </div>
      ) : null}
      {error ? <p className="cal-tools__error" role="alert">{describe(error)}</p> : null}
    </section>
  );
}
