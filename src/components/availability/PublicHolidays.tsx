import { useEffect, useState } from 'react';
import type { AvailabilitySpec, HolidayRegion } from '../../types';
import type { EditorAction } from '../../hooks/useAvailabilityEditor';
import type { HolidayDay } from '../../hooks/useAvailabilitySchedule';
import { cx, useCalendarUi } from '../../theme';
import { dateLabel } from './DateChanges';

export interface PublicHolidaysProps {
  spec: AvailabilitySpec;
  edit: (a: EditorAction) => void;
  /** The places with holidays, as the service lists them. Omit for a free-text region code. */
  regions?: HolidayRegion[];
  /** The product's pass to the service's holiday list. Omit to hide the per-day choices. */
  holidays?: (region: string, year: number) => Promise<HolidayDay[]>;
  disabled?: boolean;
}

/** Close on a region's public holidays (dates the service holds), except the ones chosen to work. */
export function PublicHolidays({ spec, edit, regions, holidays, disabled }: PublicHolidaysProps) {
  const { labels } = useCalendarUi();
  const region = spec.holidays?.observe ? spec.holidays.region : null;
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [days, setDays] = useState<HolidayDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Ticking "observe" again returns to the place the person had, else the first the service lists.
  const fallbackRegion = spec.holidays?.region ?? regions?.[0]?.code ?? null;
  const work = new Set(spec.holidays?.work ?? []);

  useEffect(() => {
    if (!region || !holidays) return;
    let live = true;
    holidays(region, year)
      .then((rows) => {
        if (!live) return;
        setFailed(false);
        setDays(rows);
      })
      .catch(() => {
        // Never show "no holidays" for a list that could not be read.
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      setDays(null);
    };
  }, [region, year, holidays]);

  return (
    <div className="cal-avail__section">
      <p className="cal-avail__intro">{labels.availHolidaysIntro}</p>

      <div className="cal-avail__form">
        <label className="cal-avail__check">
          <input
            type="checkbox"
            checked={region !== null}
            disabled={disabled || fallbackRegion === null}
            onChange={(e) => edit({ type: 'setHolidays', region: e.target.checked ? fallbackRegion : null })}
          />
          {labels.availObserve}
        </label>
        <label className="cal-avail__field">
          {labels.availRegion}
          {regions && regions.length ? (
            <select className="cal-input" value={region ?? ''} disabled={disabled || region === null} onChange={(e) => edit({ type: 'setHolidays', region: e.target.value })}>
              {region === null ? <option value="" /> : null}
              {regions.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          ) : (
            <input className="cal-input" value={region ?? ''} disabled={disabled || region === null} onChange={(e) => edit({ type: 'setHolidays', region: e.target.value.toUpperCase() || null })} />
          )}
        </label>
        {region && holidays ? (
          <div className="cal-avail__year" role="group">
            <button type="button" className="cal-btn" onClick={() => setYear(year - 1)} aria-label={String(year - 1)}>‹</button>
            <span>{year}</span>
            <button type="button" className="cal-btn" onClick={() => setYear(year + 1)} aria-label={String(year + 1)}>›</button>
          </div>
        ) : null}
      </div>

      {region && holidays && failed ? <p className="cal-avail__error" role="alert">{labels.availFailed}</p> : null}

      {region && holidays && !failed && days !== null ? (
        days.length === 0 ? (
          <p className="cal-avail__empty">{labels.availNoHolidays}</p>
        ) : (
          <ul className="cal-avail__list">
            {days.map((d) => (
              <li key={d.date} className={cx('cal-avail__item', work.has(d.date) && 'cal-avail__item--working')}>
                <span className="cal-avail__item-date">{dateLabel(d.date)}</span>
                <span className="cal-avail__item-what">{d.name}</span>
                <label className="cal-avail__check">
                  <input type="checkbox" checked={work.has(d.date)} disabled={disabled} onChange={(e) => edit({ type: 'setHolidayWork', date: d.date, working: e.target.checked })} />
                  {labels.availWorking}
                </label>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
