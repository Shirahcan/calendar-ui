import { useId, useState, type Dispatch } from 'react';
import type { EditorAction } from '../hooks/useAvailabilityEditor';
import type { AvailabilitySpec, DayName } from '../types';

export interface AvailabilityEditorProps {
  spec: AvailabilitySpec;
  dispatch: Dispatch<EditorAction>;
  problems: string[];
  /** Hide sections a product does not use (MployNow hosts only add dates). */
  sections?: Array<'zone' | 'weekly' | 'dates' | 'overrides' | 'blocks' | 'holidays'>;
  className?: string;
}

const DAYS: { key: DayName; label: string }[] = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
];

function zones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };

  return intl.supportedValuesOf?.('timeZone') ?? [];
}

/** Hoisted (static-components rule): one row of date-specific windows. */
function DatedRows({ title, help, rows, onSet, onRemove }: {
  title: string; help: string; rows: { date: string; windows: [string, string][] }[];
  onSet: (date: string, windows: [string, string][]) => void; onRemove: (date: string) => void;
}) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');

  return (
    <fieldset className="cal-editor__section">
      <legend>{title}</legend>
      <p className="cal-editor__help">{help}</p>
      <ul className="cal-editor__list">
        {rows.map((r) => (
          <li key={r.date}>
            <span>{r.date}</span>
            <span>{r.windows.length === 0 ? 'Closed' : r.windows.map(([s, e]) => `${s} to ${e}`).join(', ')}</span>
            <button type="button" className="cal-btn cal-btn--ghost" onClick={() => onRemove(r.date)}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="cal-editor__row">
        <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="time" aria-label="To" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button type="button" className="cal-btn" disabled={!date} onClick={() => {
          const existing = rows.find((r) => r.date === date)?.windows ?? [];
          onSet(date, [...existing, [start, end]]);
        }}>Add</button>
      </div>
    </fieldset>
  );
}

/** The person's availability: weekly hours, dated windows, overrides, time off, holidays. */
export function AvailabilityEditor({ spec, dispatch, problems, sections = ['zone', 'weekly', 'dates', 'overrides', 'blocks', 'holidays'], className }: AvailabilityEditorProps) {
  const zoneListId = useId();
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  const has = (s: (typeof sections)[number]) => sections.includes(s);

  return (
    <div className={`cal-editor ${className ?? ''}`}>
      {problems.length > 0 && (
        <ul className="cal-editor__problems" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}

      {has('zone') && (
        <fieldset className="cal-editor__section">
          <legend>Time zone</legend>
          <input list={zoneListId} aria-label="Time zone" value={spec.timezone.zone}
            onChange={(e) => dispatch({ type: 'setZone', zone: e.target.value })} />
          <datalist id={zoneListId}>{zones().map((z) => <option key={z} value={z} />)}</datalist>
          <label className="cal-editor__check">
            <input type="checkbox" checked={Boolean(spec.timezone.follow_host_profile)}
              onChange={(e) => dispatch({ type: 'setZone', zone: spec.timezone.zone, followHostProfile: e.target.checked })} />
            Follow my profile time zone when I travel
          </label>
        </fieldset>
      )}

      {has('weekly') && (
        <fieldset className="cal-editor__section">
          <legend>Weekly hours</legend>
          {(spec.weekly ?? []).map((rule, i) => (
            <div key={i} className="cal-editor__row">
              <div className="cal-editor__days" role="group" aria-label={`Days for hours ${i + 1}`}>
                {DAYS.map((d) => (
                  <button type="button" key={d.key} aria-pressed={rule.days.includes(d.key)}
                    className={`cal-chip${rule.days.includes(d.key) ? ' is-on' : ''}`}
                    onClick={() => dispatch({ type: 'updateWeekly', index: i, rule: {
                      ...rule, days: rule.days.includes(d.key) ? rule.days.filter((x) => x !== d.key) : [...rule.days, d.key],
                    } })}>{d.label}</button>
                ))}
              </div>
              <input type="time" aria-label="From" value={rule.start} onChange={(e) => dispatch({ type: 'updateWeekly', index: i, rule: { ...rule, start: e.target.value } })} />
              <input type="time" aria-label="To" value={rule.end} onChange={(e) => dispatch({ type: 'updateWeekly', index: i, rule: { ...rule, end: e.target.value } })} />
              <button type="button" className="cal-btn cal-btn--ghost" onClick={() => dispatch({ type: 'removeWeekly', index: i })}>Remove</button>
            </div>
          ))}
          <button type="button" className="cal-btn" onClick={() => dispatch({ type: 'addWeekly', rule: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00' } })}>Add hours</button>
        </fieldset>
      )}

      {has('dates') && (
        <DatedRows title="Extra dates" help="Times you are free on a specific date, on top of your weekly hours."
          rows={spec.dates ?? []} onSet={(date, windows) => dispatch({ type: 'setDate', date, windows })} onRemove={(date) => dispatch({ type: 'removeDate', date })} />
      )}

      {has('overrides') && (
        <DatedRows title="Different hours on a date" help="Replaces your weekly hours for that date only. Remove every window to close the day."
          rows={spec.overrides ?? []} onSet={(date, windows) => dispatch({ type: 'setOverride', date, windows })} onRemove={(date) => dispatch({ type: 'removeOverride', date })} />
      )}

      {has('blocks') && (
        <fieldset className="cal-editor__section">
          <legend>Time off</legend>
          <ul className="cal-editor__list">
            {(spec.blocks ?? []).map((b, i) => (
              <li key={i}>
                <span>{'from' in b ? `${b.from} to ${b.to}` : `${b.start.replace('T', ' ')} to ${b.end.replace('T', ' ')}`}</span>
                <button type="button" className="cal-btn cal-btn--ghost" onClick={() => dispatch({ type: 'removeBlock', index: i })}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="cal-editor__row">
            <input type="date" aria-label="First day off" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} />
            <input type="date" aria-label="Last day off" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} />
            <button type="button" className="cal-btn" disabled={!blockFrom} onClick={() => {
              dispatch({ type: 'addBlock', block: { from: blockFrom, to: blockTo || blockFrom } });
              setBlockFrom('');
              setBlockTo('');
            }}>Add time off</button>
          </div>
        </fieldset>
      )}

      {has('holidays') && (
        <fieldset className="cal-editor__section">
          <legend>Public holidays</legend>
          <label className="cal-editor__check">
            <input type="checkbox" checked={Boolean(spec.holidays?.observe)}
              onChange={(e) => dispatch({ type: 'setHolidays', region: e.target.checked ? (spec.holidays?.region ?? 'CA') : null })} />
            Close on public holidays in
          </label>
          <input aria-label="Holiday region (e.g. CA-ON, NG)" value={spec.holidays?.region ?? ''} disabled={!spec.holidays?.observe}
            onChange={(e) => dispatch({ type: 'setHolidays', region: e.target.value.toUpperCase() || null })} />
        </fieldset>
      )}
    </div>
  );
}
