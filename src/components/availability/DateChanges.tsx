import { useState } from 'react';
import type { AvailabilitySpec } from '../../types';
import type { EditorAction } from '../../hooks/useAvailabilityEditor';
import { cx, useCalendarUi } from '../../theme';

/** "Mon, Oct 12": a date row names a calendar date, never a moment, so it is read in UTC. */
export function dateLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);

  return Number.isNaN(d.getTime()) ? ymd : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** One date's own hours (replacing the weekly pattern that day), or the date closed. */
export function DateChanges({ spec, edit, disabled }: { spec: AvailabilitySpec; edit: (a: EditorAction) => void; disabled?: boolean }) {
  const { labels, classNames } = useCalendarUi();
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const [closed, setClosed] = useState(false);
  const btn = cx('cal-btn', classNames.button);
  const rows = spec.overrides ?? [];

  const add = () => {
    if (!date) return;
    edit({ type: 'setOverride', date, windows: closed ? [] : [[start, end]] });
    setDate('');
  };

  return (
    <div className="cal-avail__section">
      <p className="cal-avail__intro">{labels.availDatesIntro}</p>

      <div className="cal-avail__form">
        <label className="cal-avail__field">
          {labels.availDate}
          <input className="cal-input" type="date" value={date} disabled={disabled} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="cal-avail__check">
          <input type="checkbox" checked={closed} disabled={disabled} onChange={(e) => setClosed(e.target.checked)} />
          {labels.availClosedAllDay}
        </label>
        {!closed ? (
          <>
            <label className="cal-avail__field">
              {labels.availFrom}
              <input className="cal-input" type="time" step={900} value={start} disabled={disabled} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="cal-avail__field">
              {labels.availTo}
              <input className="cal-input" type="time" step={900} value={end} disabled={disabled} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </>
        ) : null}
        <button type="button" className={btn} disabled={disabled || !date} onClick={add}>
          {labels.availAddChange}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="cal-avail__empty">{labels.availNoChanges}</p>
      ) : (
        <ul className="cal-avail__list">
          {rows.map((r) => (
            <li key={r.date} className="cal-avail__item">
              <span className="cal-avail__item-date">{dateLabel(r.date)}</span>
              <span className="cal-avail__item-what">{r.windows.length ? r.windows.map(([s, e]) => `${s}-${e}`).join(', ') : labels.availClosedAllDay}</span>
              <button type="button" className={cx(btn, 'cal-btn--ghost')} disabled={disabled} onClick={() => edit({ type: 'removeOverride', date: r.date })}>
                {labels.availRemove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
