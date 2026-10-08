import { useCallback, useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';
import type { HolidayRegion } from '../types';
import type { HolidayDay } from '../hooks/useAvailabilitySchedule';
import { RowMenu } from './RowMenu';

export type HolidayRuleKind = 'fixed' | 'nth_weekday' | 'last_weekday' | 'weekday_on_or_before' | 'easter_offset';

/** One holiday's rule, as calendar-service holds it (GET /v1/holiday-definitions/{region}). */
export interface HolidayRule {
  id: number;
  name: string;
  kind: HolidayRuleKind;
  params: { month?: number; day?: number; weekday?: number; n?: number; days?: number };
  active: boolean;
  /** This year's date, or null when the rule gives none this year. */
  next?: string | null;
}

export type HolidayRuleInput = Omit<HolidayRule, 'id' | 'next'>;

/** The product's own backend, which calls calendar-service (the package never calls the service). */
export interface HolidayRulesAdapter {
  regions: () => Promise<HolidayRegion[]>;
  putRegion: (code: string, name: string) => Promise<HolidayRegion[]>;
  rules: (region: string) => Promise<HolidayRule[]>;
  /** id null = a new rule. Returns the place's rules after the change (its dates follow at once). */
  save: (region: string, id: number | null, rule: HolidayRuleInput) => Promise<HolidayRule[]>;
  remove: (region: string, id: number) => Promise<HolidayRule[]>;
  preview: (region: string, year: number) => Promise<HolidayDay[]>;
}

export interface HolidayRulesEditorProps {
  adapter: HolidayRulesAdapter;
  /** Ask before removing a rule (a product's own dialog); defaults to window.confirm. */
  confirmRemove?: (rule: HolidayRule, question: string) => Promise<boolean>;
  describeError?: (error: unknown) => string;
  className?: string;
}

const EMPTY: HolidayRuleInput = { name: '', kind: 'fixed', params: { month: 1, day: 1 }, active: true };
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** The parameters each kind of rule needs, with sensible starting values. */
function paramsFor(kind: HolidayRuleKind, p: HolidayRule['params']): HolidayRule['params'] {
  switch (kind) {
    case 'fixed':
      return { month: p.month ?? 1, day: p.day ?? 1 };
    case 'nth_weekday':
      return { month: p.month ?? 1, weekday: p.weekday ?? 1, n: p.n ?? 1 };
    case 'last_weekday':
      return { month: p.month ?? 1, weekday: p.weekday ?? 1 };
    case 'weekday_on_or_before':
      return { month: p.month ?? 1, day: p.day ?? 1, weekday: p.weekday ?? 1 };
    case 'easter_offset':
      return { days: p.days ?? 0 };
  }
}

/**
 * The places that have public holidays, and the rule for each holiday, for a product's admins.
 * The rules live in calendar-service and every product reads them; a change here moves the dates
 * for everyone straight away, with no developer and no deploy.
 */
export function HolidayRulesEditor({ adapter, confirmRemove, describeError, className }: HolidayRulesEditorProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [regions, setRegions] = useState<HolidayRegion[] | null>(null);
  const [region, setRegion] = useState<string>('');
  const [rules, setRules] = useState<HolidayRule[] | null>(null);
  const [form, setForm] = useState<HolidayRuleInput>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [newPlace, setNewPlace] = useState({ code: '', name: '' });
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [preview, setPreview] = useState<HolidayDay[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.rulesFailed));
  const ask = confirmRemove ?? (async (_r: HolidayRule, q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await work();
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    adapter.regions().then((r) => {
      if (!live) return;
      setRegions(r);
      setRegion((current) => current || r[0]?.code || '');
    }).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adapter]);

  useEffect(() => {
    if (!region) return;
    let live = true;
    adapter.rules(region).then((r) => live && setRules(r)).catch((e) => live && setError(e));
    adapter.preview(region, year).then((p) => live && setPreview(p)).catch((e) => live && setError(e));
    return () => {
      live = false;
      setRules(null);
      setPreview(null);
    };
  }, [adapter, region, year]);

  const after = async (next: HolidayRule[] | undefined) => {
    if (!next) return;
    setRules(next);
    setForm(EMPTY);
    setEditing(null);
    setPreview(await adapter.preview(region, year).catch(() => null));
  };

  const submit = () => void run(() => adapter.save(region, editing, form)).then(after);
  const remove = async (rule: HolidayRule) => {
    if (await ask(rule, labels.rulesConfirmRemove(rule.name))) {
      await after(await run(() => adapter.remove(region, rule.id)));
    }
  };
  const addPlace = () => void run(() => adapter.putRegion(newPlace.code.trim().toUpperCase(), newPlace.name.trim())).then((r) => {
    if (!r) return;
    setRegions(r);
    setRegion(newPlace.code.trim().toUpperCase());
    setNewPlace({ code: '', name: '' });
  });

  const setParam = (key: keyof HolidayRule['params'], value: number) => setForm((f) => ({ ...f, params: { ...f.params, [key]: value } }));
  const select = (key: 'month' | 'weekday', options: number[], label: string, name: (n: number) => string) => (
    <label className="cal-rules__field">
      {label}
      <select className="cal-input" value={String(form.params[key] ?? options[0])} disabled={busy} onChange={(e) => setParam(key, Number(e.target.value))}>
        {options.map((o) => <option key={o} value={String(o)}>{name(o)}</option>)}
      </select>
    </label>
  );
  const number = (key: 'day' | 'n' | 'days', label: string, min: number, max: number) => (
    <label className="cal-rules__field">
      {label}
      <input className="cal-input" type="number" min={min} max={max} value={String(form.params[key] ?? '')} disabled={busy} onChange={(e) => setParam(key, Math.round(Number(e.target.value) || 0))} />
    </label>
  );
  const btn = cx('cal-btn', classNames.button);
  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);

  return (
    <section className={cx('cal-rules', classNames.holidayRulesEditor, className)} aria-labelledby={`${ids}-t`}>
      <h3 className="cal-rules__title" id={`${ids}-t`}>{labels.rulesTitle}</h3>
      <p className="cal-rules__intro">{labels.rulesIntro}</p>
      {error ? <p className="cal-rules__error" role="alert">{describe(error)}</p> : null}
      {regions === null && !error ? <p className="cal-rules__note">{labels.rulesLoading}</p> : null}

      {regions !== null ? (
        <div className="cal-rules__bar">
          <label className="cal-rules__field">
            {labels.rulesPlace}
            <select className="cal-input" value={region} disabled={busy} onChange={(e) => { setRegion(e.target.value); setEditing(null); setForm(EMPTY); }}>
              {regions.map((r) => <option key={r.code} value={r.code}>{r.name} ({r.code})</option>)}
            </select>
          </label>
          <div className="cal-rules__add-place">
            <input className="cal-input" aria-label={labels.rulesPlaceCode} placeholder={labels.rulesPlaceCode} value={newPlace.code} maxLength={6} disabled={busy} onChange={(e) => setNewPlace({ ...newPlace, code: e.target.value })} />
            <input className="cal-input" aria-label={labels.rulesPlaceName} placeholder={labels.rulesPlaceName} value={newPlace.name} disabled={busy} onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })} />
            <button type="button" className={btn} disabled={busy || !newPlace.code.trim() || !newPlace.name.trim()} onClick={addPlace}>{labels.rulesAddPlace}</button>
          </div>
        </div>
      ) : null}

      {region && rules !== null ? (
        <>
          {rules.length === 0 ? <p className="cal-rules__note">{labels.rulesNone}</p> : (
            <ul className="cal-rules__list">
              {rules.map((r) => (
                <li key={r.id} className={cx('cal-rules__item', !r.active && 'cal-rules__item--off')}>
                  <span className="cal-rules__name">{r.name}</span>
                  <span className="cal-rules__how">{labels.rulesDescribe(r.kind, r.params)}</span>
                  <span className="cal-rules__next">{r.next ?? labels.rulesNoDate}</span>
                  <span className="cal-rules__item-actions">
                    <RowMenu
                      label={labels.rulesActionsFor(r.name)}
                      disabled={busy}
                      items={[
                        { label: labels.rulesEdit, onSelect: () => { setEditing(r.id); setForm({ name: r.name, kind: r.kind, params: r.params, active: r.active }); } },
                        { label: labels.rulesRemove, danger: true, onSelect: () => void remove(r) },
                      ]}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <fieldset className="cal-rules__form">
            <legend>{editing === null ? labels.rulesAdd : labels.rulesChange}</legend>
            <label className="cal-rules__field">
              {labels.rulesName}
              <input className="cal-input" value={form.name} disabled={busy} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="cal-rules__field">
              {labels.rulesKind}
              <select className="cal-input" value={form.kind} disabled={busy} onChange={(e) => { const kind = e.target.value as HolidayRuleKind; setForm({ ...form, kind, params: paramsFor(kind, form.params) }); }}>
                {(['fixed', 'nth_weekday', 'last_weekday', 'weekday_on_or_before', 'easter_offset'] as const).map((k) => <option key={k} value={k}>{labels.rulesKindName(k)}</option>)}
              </select>
            </label>
            {form.kind === 'nth_weekday' ? number('n', labels.rulesNth, 1, 5) : null}
            {form.kind !== 'fixed' && form.kind !== 'easter_offset' ? select('weekday', WEEKDAYS, labels.rulesWeekday, labels.rulesWeekdayName) : null}
            {form.kind !== 'easter_offset' ? select('month', MONTHS, labels.rulesMonth, labels.rulesMonthName) : null}
            {form.kind === 'fixed' || form.kind === 'weekday_on_or_before' ? number('day', labels.rulesDay, 1, 31) : null}
            {form.kind === 'easter_offset' ? number('days', labels.rulesEasterDays, -60, 60) : null}
            <label className="cal-rules__check">
              <input type="checkbox" checked={form.active} disabled={busy} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {labels.rulesActive}
            </label>
            <div className="cal-rules__actions">
              <button type="button" className={primary} disabled={busy || !form.name.trim()} onClick={submit}>{editing === null ? labels.rulesAdd : labels.rulesSave}</button>
              {editing !== null ? <button type="button" className={btn} disabled={busy} onClick={() => { setEditing(null); setForm(EMPTY); }}>{labels.availDiscard}</button> : null}
            </div>
          </fieldset>

          <div className="cal-rules__preview">
            <div className="cal-avail__year" role="group">
              <button type="button" className="cal-btn" onClick={() => setYear(year - 1)} aria-label={String(year - 1)}>‹</button>
              <span>{labels.rulesPreview(year)}</span>
              <button type="button" className="cal-btn" onClick={() => setYear(year + 1)} aria-label={String(year + 1)}>›</button>
            </div>
            {preview === null ? null : preview.length === 0 ? <p className="cal-rules__note">{labels.rulesNone}</p> : (
              <ul className="cal-rules__dates">
                {preview.map((d) => <li key={d.date}><span>{d.date}</span> {d.name}</li>)}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
