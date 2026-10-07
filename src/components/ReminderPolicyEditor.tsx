import { useCallback, useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';

/** A product's booking reminder times, as calendar-service reports them (GET /v1/reminders/policy). */
export interface ReminderPolicy {
  offsets_minutes: number[];
  is_default: boolean;
  default_offsets_minutes?: number[];
}

/**
 * What the editor needs from the product: its own backend, which calls calendar-service through
 * shirahcan/calendar-client (the package never calls the service).
 */
export interface ReminderPolicyAdapter {
  load: () => Promise<ReminderPolicy>;
  /** null = follow the standard times again (and whatever they become later). */
  save: (offsetsMinutes: number[] | null) => Promise<ReminderPolicy>;
}

export interface ReminderPolicyEditorProps {
  adapter: ReminderPolicyAdapter;
  describeError?: (error: unknown) => string;
  className?: string;
}

/** The service's own limits (ReminderPolicy::MIN_MINUTES / MAX_MINUTES and the 6-row cap). */
const MIN = 1;
const MAX = 10080;
const MAX_ROWS = 6;
const UNIT = { minutes: 1, hours: 60, days: 1440 } as const;
type Unit = keyof typeof UNIT;

const sortDesc = (xs: number[]) => [...new Set(xs)].sort((a, b) => b - a);
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * When a product's meetings are reminded, shared by every product (the times live in
 * calendar-service; the product only words and sends each reminder). An admin changes them
 * here without a developer or a deploy.
 */
export function ReminderPolicyEditor({ adapter, describeError, className }: ReminderPolicyEditorProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [saved, setSaved] = useState<ReminderPolicy | null>(null);
  const [draft, setDraft] = useState<number[]>([]);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<Unit>('hours');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const describe = describeError ?? ((e: unknown) => (e instanceof Error && e.message ? e.message : labels.reminderFailed));

  const adopt = useCallback((p: ReminderPolicy) => {
    setSaved(p);
    setDraft(sortDesc(p.offsets_minutes));
  }, []);

  useEffect(() => {
    let live = true;
    adapter.load().then((p) => live && adopt(p)).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adapter, adopt]);

  const add = () => {
    setProblem(null);
    const n = Number(amount);
    const minutes = Number.isFinite(n) ? Math.round(n * UNIT[unit]) : NaN;
    if (!Number.isFinite(minutes) || minutes < MIN || minutes > MAX) {
      setProblem(labels.reminderOutOfRange);
      return;
    }
    if (!draft.includes(minutes) && draft.length >= MAX_ROWS) {
      setProblem(labels.reminderTooMany(MAX_ROWS));
      return;
    }
    setDraft(sortDesc([...draft, minutes]));
    setAmount('');
    setJustSaved(false);
  };

  const save = async (offsets: number[] | null) => {
    setBusy(true);
    setError(null);
    try {
      adopt(await adapter.save(offsets));
      setJustSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const btn = cx('cal-btn', classNames.button);
  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);
  const dirty = saved !== null && !same(draft, sortDesc(saved.offsets_minutes));

  return (
    <section className={cx('cal-reminders', classNames.reminderEditor, className)} aria-labelledby={`${ids}-t`}>
      <h3 className="cal-reminders__title" id={`${ids}-t`}>{labels.reminderTitle}</h3>
      <p className="cal-reminders__intro">{labels.reminderIntro}</p>

      {saved === null && !error ? <p className="cal-reminders__note">{labels.reminderLoading}</p> : null}
      {error ? <p className="cal-reminders__error" role="alert">{describe(error)}</p> : null}

      {saved !== null ? (
        <>
          {draft.length === 0 ? (
            <p className="cal-reminders__note">{labels.reminderNone}</p>
          ) : (
            <ul className="cal-reminders__list">
              {draft.map((m) => (
                <li key={m} className="cal-reminders__chip">
                  {labels.reminderLead(m)}
                  <button type="button" aria-label={labels.reminderRemove(labels.reminderLead(m))} onClick={() => { setDraft(draft.filter((x) => x !== m)); setJustSaved(false); }} disabled={busy}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="cal-reminders__add">
            <label className="cal-reminders__field">
              {labels.reminderAddAmount}
              <input className="cal-input" type="number" min={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
            </label>
            <label className="cal-reminders__field">
              {labels.reminderAddUnit}
              <select className="cal-input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                <option value="minutes">{labels.reminderUnitMinutes}</option>
                <option value="hours">{labels.reminderUnitHours}</option>
                <option value="days">{labels.reminderUnitDays}</option>
              </select>
            </label>
            <button type="button" className={btn} onClick={add} disabled={busy || amount === ''}>{labels.reminderAdd}</button>
          </div>
          {problem ? <p className="cal-reminders__error" role="alert">{problem}</p> : null}

          <div className="cal-reminders__actions">
            <button type="button" className={primary} onClick={() => save(draft)} disabled={busy || !dirty}>{labels.reminderSave}</button>
            {!saved.is_default ? (
              <button type="button" className={btn} onClick={() => save(null)} disabled={busy}>{labels.reminderUseDefault}</button>
            ) : null}
            {justSaved && !dirty ? <span className="cal-reminders__note" role="status">{labels.reminderSaved}</span> : null}
            {saved.is_default && !dirty ? <span className="cal-reminders__note">{labels.reminderIsDefault}</span> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
