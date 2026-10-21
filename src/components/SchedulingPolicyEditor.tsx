import { useCallback, useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';
import type { AvailabilitySpec, SchedulingOffered, SchedulingPolicy, SchedulingWaitEvent } from '../types';
import { reduceSpec } from '../hooks/useAvailabilityEditor';
import { WeeklyHours } from './availability/WeeklyHours';

/** A product's scheduling policy as calendar-service reports it (GET /v1/scheduling/policy). */
export interface SchedulingPolicyState {
  policy: SchedulingPolicy;
  is_default: boolean;
  defaults?: SchedulingPolicy;
  /** What the server can offer right now (includes whether a backup call is ready, and why not). */
  offered?: SchedulingOffered;
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
  /** Offer the backup call setting (default on). A product that ships it dark passes false. */
  showBackupCall?: boolean;
  /**
   * The events this product reports when people book (`since`), each offered as a wait in hours
   * (`wait_after`). None: the section is not shown. Waits on events not listed are kept as they are.
   */
  waitEvents?: SchedulingWaitEvent[];
  /**
   * Named limits on how long a person may set their own wait (`wait_after_limits`), e.g.
   * `{ key: 'marketplace', label: 'marketplace consultants' }`. None: the fields are not shown.
   */
  waitLimits?: SchedulingWaitEvent[];
  className?: string;
}

/** The service sends an empty map as `[]`; read it as no waits. */
const normalise = (s: SchedulingPolicyState): SchedulingPolicyState => {
  const map = (m: Record<string, number> | undefined) => (Array.isArray(m) || m == null ? {} : m);
  return { ...s, policy: { ...s.policy, wait_after: map(s.policy.wait_after), wait_after_limits: map(s.policy.wait_after_limits) } };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const CALL_TOOLS = ['zoom', 'google_meet'] as const;

/**
 * How a product's bookings are scheduled, for its admins: buffer floor, ceiling, usual value and
 * choices, notice, how far ahead, how long a picked time is held, the week a new person starts
 * with, whether holidays are observed by default, how long ended meetings are kept, which call tools
 * people may use and the backup when a call's own room cannot be rescued. The values live in calendar-service; an
 * admin changes them here without a developer or a deploy.
 */
export function SchedulingPolicyEditor({ adapter, describeError, showBackupCall = true, waitEvents = [], waitLimits = [], className }: SchedulingPolicyEditorProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [saved, setSaved] = useState<SchedulingPolicyState | null>(null);
  const [draft, setDraft] = useState<SchedulingPolicy | null>(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [justSaved, setJustSaved] = useState(false);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.policyFailed));

  const adopt = useCallback((state: SchedulingPolicyState) => {
    const s = normalise(state);
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

          {waitEvents.length > 0 ? (
            <fieldset className="cal-policy__group">
              <legend>{labels.policyWait}</legend>
              <p className="cal-policy__hint">{labels.policyWaitHint}</p>
              <div className="cal-policy__row">
                {waitEvents.map((ev) => (
                  <div key={ev.key} className="cal-policy__field">
                    <label htmlFor={`${ids}-wait-${ev.key}`}>{labels.policyWaitField(ev.label)}</label>
                    <input
                      id={`${ids}-wait-${ev.key}`}
                      className="cal-input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-describedby={ev.hint ? `${ids}-wait-${ev.key}-hint` : undefined}
                      value={String(Math.round((draft.wait_after?.[ev.key] ?? 0) / 60))}
                      disabled={busy}
                      onChange={(e) => set('wait_after', { ...(draft.wait_after ?? {}), [ev.key]: Math.max(0, Math.round(Number(e.target.value) || 0)) * 60 })}
                    />
                    {ev.hint ? <span className="cal-policy__hint" id={`${ids}-wait-${ev.key}-hint`}>{ev.hint}</span> : null}
                  </div>
                ))}
                {waitLimits.map((lim) => (
                  <div key={lim.key} className="cal-policy__field">
                    <label htmlFor={`${ids}-limit-${lim.key}`}>{labels.policyWaitLimit(lim.label)}</label>
                    <input
                      id={`${ids}-limit-${lim.key}`}
                      className="cal-input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-describedby={`${ids}-limit-${lim.key}-hint`}
                      value={String(Math.round((draft.wait_after_limits?.[lim.key] ?? 0) / 60))}
                      disabled={busy}
                      onChange={(e) => set('wait_after_limits', { ...(draft.wait_after_limits ?? {}), [lim.key]: Math.max(0, Math.round(Number(e.target.value) || 0)) * 60 })}
                    />
                    <span className="cal-policy__hint" id={`${ids}-limit-${lim.key}-hint`}>{lim.hint ?? labels.policyWaitLimitHint}</span>
                  </div>
                ))}
              </div>
            </fieldset>
          ) : null}

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

          <fieldset className="cal-policy__group">
            <legend>{labels.policyCalls}</legend>
            <div className="cal-policy__field" role="group" aria-labelledby={`${ids}-tools`} aria-describedby={`${ids}-tools-hint`}>
              <span id={`${ids}-tools`}>{labels.policyCallToolsOffered}</span>
              {CALL_TOOLS.map((tool) => (
                <label key={tool} className="cal-policy__check">
                  <input
                    type="checkbox"
                    checked={(draft.call_tools_offered ?? []).includes(tool)}
                    disabled={busy}
                    onChange={(e) => set('call_tools_offered', CALL_TOOLS.filter((t) => (t === tool ? e.target.checked : (draft.call_tools_offered ?? []).includes(t))))}
                  />
                  {labels.policyCallTool(tool)}
                </label>
              ))}
              <span className="cal-policy__hint" id={`${ids}-tools-hint`}>{labels.policyCallToolsHint}</span>
            </div>
            {showBackupCall ? <div className="cal-policy__field">
              <label htmlFor={`${ids}-backup`}>{labels.policyBackupCall}</label>
              <select
                id={`${ids}-backup`}
                className="cal-input"
                aria-describedby={`${ids}-backup-hint`}
                value={draft.backup_call_tool ?? ''}
                disabled={busy}
                onChange={(e) => set('backup_call_tool', e.target.value === 'google_meet' ? 'google_meet' : null)}
              >
                <option value="">{labels.policyBackupCallOff}</option>
                <option value="google_meet">{labels.policyCallTool('google_meet')}</option>
              </select>
              <span className="cal-policy__hint" id={`${ids}-backup-hint`}>
                {labels.policyBackupCallHint}
                {!dirty && saved.offered?.backup_call?.tool ? (
                  <> {saved.offered.backup_call.ready ? labels.policyBackupReady : labels.policyBackupNotReady(saved.offered.backup_call.reason ?? '')}</>
                ) : null}
              </span>
            </div> : null}
          </fieldset>

          <fieldset className="cal-policy__group">
            <legend>{labels.policyRecords}</legend>
            <div className="cal-policy__field">
              <label htmlFor={`${ids}-erase`}>{labels.policyEraseAfter}</label>
              <input
                id={`${ids}-erase`}
                className="cal-input"
                type="number"
                min={30}
                max={3650}
                inputMode="numeric"
                aria-describedby={`${ids}-erase-hint`}
                value={draft.erase_ended_bookings_after_days == null ? '' : String(draft.erase_ended_bookings_after_days)}
                disabled={busy}
                onChange={(e) => set('erase_ended_bookings_after_days', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value) || 0)))}
              />
              <span className="cal-policy__hint" id={`${ids}-erase-hint`}>{labels.policyEraseAfterHint}</span>
            </div>
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
