import { useCallback, useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';
import type { AvailabilitySpec, SchedulingPolicy } from '../types';
import { reduceSpec } from '../hooks/useAvailabilityEditor';
import { WeeklyHours } from './availability/WeeklyHours';

/** A product's scheduling policy as calendar-service reports it (GET /v1/scheduling/policy). */
export interface SchedulingPolicyState {
  policy: SchedulingPolicy;
  is_default: boolean;
  defaults?: SchedulingPolicy;
}

/** The product's own backend, which calls calendar-service (the package never calls the service). */
export interface SchedulingPolicyAdapter {
  load: () => Promise<SchedulingPolicyState>;
  /** null = follow the service defaults again. The service validates and refuses with reasons. */
  save: (policy: SchedulingPolicy | null) => Promise<SchedulingPolicyState>;
}

export interface SchedulingPolicyEditorProps {
  adapter: SchedulingPolicyAdapter;
  describeError?: (error: unknown) => string;
  className?: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * How a product's bookings are scheduled, for its admins: buffer floor, ceiling, usual value and
 * choices, notice, how far ahead, how long a picked time is held, the week a new person starts
 * with, and whether holidays are observed by default. The values live in calendar-service; an
 * admin changes them here without a developer or a deploy.
 */
export function SchedulingPolicyEditor({ adapter, describeError, className }: SchedulingPolicyEditorProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [saved, setSaved] = useState<SchedulingPolicyState | null>(null);
  const [draft, setDraft] = useState<SchedulingPolicy | null>(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [justSaved, setJustSaved] = useState(false);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.policyFailed));

  const adopt = useCallback((s: SchedulingPolicyState) => {
    setSaved(s);
    setDraft(s.policy);
  }, []);

  useEffect(() => {
    let live = true;
    adapter.load().then((s) => live && adopt(s)).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adapter, adopt]);

  const save = async (policy: SchedulingPolicy | null) => {
    setBusy(true);
    setError(null);
    try {
      adopt(await adapter.save(policy));
      setJustSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof SchedulingPolicy>(key: K, value: SchedulingPolicy[K]) => {
    setJustSaved(false);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };
  const num = (key: 'min_buffer_minutes' | 'max_buffer_minutes' | 'default_buffer_minutes' | 'min_notice_minutes' | 'horizon_days', label: string, hint?: string) => (
    <div className="cal-policy__field">
      <label htmlFor={`${ids}-${key}`}>{label}</label>
      <input
        id={`${ids}-${key}`}
        className="cal-input"
        type="number"
        min={0}
        inputMode="numeric"
        aria-describedby={hint ? `${ids}-${key}-hint` : undefined}
        value={draft ? String(draft[key]) : ''}
        disabled={busy}
        onChange={(e) => set(key, Math.max(0, Math.round(Number(e.target.value) || 0)))}
      />
      {hint ? <span className="cal-policy__hint" id={`${ids}-${key}-hint`}>{hint}</span> : null}
    </div>
  );

  const addChoice = () => {
    const m = Math.round(Number(choice));
    if (!draft || !Number.isFinite(m) || m < 0 || choice === '') return;
    set('buffer_choices', [...new Set([...draft.buffer_choices, m])].sort((a, b) => a - b));
    setChoice('');
  };

  // The seed week is edited as a spec fragment through the same weekly editor people use.
  const seedSpec: AvailabilitySpec = { schema: 1, timezone: { zone: 'UTC' }, weekly: draft?.seed_weekly ?? [] };
  const btn = cx('cal-btn', classNames.button);
  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);
  const dirty = saved !== null && draft !== null && !same(draft, saved.policy);

  return (
    <section className={cx('cal-policy', classNames.policyEditor, className)} aria-labelledby={`${ids}-t`}>
      <h3 className="cal-policy__title" id={`${ids}-t`}>{labels.policyTitle}</h3>
      <p className="cal-policy__intro">{labels.policyIntro}</p>

      {saved === null && !error ? <p className="cal-policy__note">{labels.policyLoading}</p> : null}
      {error ? <p className="cal-policy__error" role="alert">{describe(error)}</p> : null}

      {draft !== null && saved !== null ? (
        <>
          <fieldset className="cal-policy__group">
            <legend>{labels.policyBuffers}</legend>
            <div className="cal-policy__row">
              {num('min_buffer_minutes', labels.policyMinBuffer)}
              {num('default_buffer_minutes', labels.policyDefaultBuffer)}
              {num('max_buffer_minutes', labels.policyMaxBuffer)}
            </div>
            <div className="cal-policy__field">
              {labels.policyBufferChoices}
              <ul className="cal-policy__chips">
                {draft.buffer_choices.map((m) => (
                  <li key={m} className="cal-policy__chip">
                    {labels.availMinutes(m)}
                    <button type="button" aria-label={labels.policyRemoveChoice(m)} disabled={busy} onClick={() => set('buffer_choices', draft.buffer_choices.filter((x) => x !== m))}>×</button>
                  </li>
                ))}
              </ul>
              <div className="cal-policy__add">
                <input className="cal-input" type="number" min={0} inputMode="numeric" aria-label={labels.policyAddChoice} value={choice} disabled={busy} onChange={(e) => setChoice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChoice(); }} />
                <button type="button" className={btn} disabled={busy || choice === ''} onClick={addChoice}>{labels.policyAddChoice}</button>
              </div>
            </div>
          </fieldset>

          <fieldset className="cal-policy__group">
            <legend>{labels.policyBooking}</legend>
            <div className="cal-policy__row">
              {num('min_notice_minutes', labels.policyNotice, labels.policyNoticeHint)}
              {num('horizon_days', labels.policyHorizon)}
              <label className="cal-policy__field">
                {labels.policyHold}
                <input className="cal-input" type="number" min={1} inputMode="numeric" value={String(Math.round(draft.hold_seconds / 60))} disabled={busy} onChange={(e) => set('hold_seconds', Math.max(1, Math.round(Number(e.target.value) || 0)) * 60)} />
              </label>
            </div>
          </fieldset>

          <fieldset className="cal-policy__group">
            <legend>{labels.policySeedWeek}</legend>
            <p className="cal-policy__hint">{labels.policySeedWeekHint}</p>
            <WeeklyHours
              spec={seedSpec}
              policy={draft}
              dayBuffers={false}
              disabled={busy}
              edit={(action) => set('seed_weekly', reduceSpec(seedSpec, action).weekly ?? [])}
            />
          </fieldset>

          <label className="cal-policy__check">
            <input type="checkbox" checked={draft.observe_holidays_by_default} disabled={busy} onChange={(e) => set('observe_holidays_by_default', e.target.checked)} />
            {labels.policyObserveHolidays}
          </label>

          <div className="cal-policy__actions">
            <button type="button" className={primary} disabled={busy || !dirty} onClick={() => void save(draft)}>{labels.policySave}</button>
            {dirty ? <button type="button" className={btn} disabled={busy} onClick={() => setDraft(saved.policy)}>{labels.availDiscard}</button> : null}
            {!saved.is_default ? <button type="button" className={btn} disabled={busy} onClick={() => void save(null)}>{labels.policyUseDefault}</button> : null}
            {!dirty && justSaved ? <span className="cal-policy__note" role="status">{labels.policySaved}</span> : null}
            {!dirty && !justSaved && saved.is_default ? <span className="cal-policy__note" role="status">{labels.policyIsDefault}</span> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
