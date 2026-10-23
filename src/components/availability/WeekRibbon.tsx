import { useState } from 'react';
import type { AvailabilitySpec, DayName } from '../../types';
import { dayWindows } from '../../hooks/useAvailabilityEditor';
import { useCalendarUi } from '../../theme';

export const WEEK: DayName[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function minutesOf(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');

  return Number(h) * 60 + Number(m);
}

/** Bars on a 24-hour track; a window ending at or before its start runs to midnight. */
function bars(windows: [string, string][]): Array<{ left: number; width: number }> {
  return windows.map(([s, e]) => {
    const a = minutesOf(s);
    const b = minutesOf(e) <= a ? 1440 : minutesOf(e);

    return { left: (a / 1440) * 100, width: ((b - a) / 1440) * 100 };
  });
}

/** YYYY-MM-DD of each day of the current week (Monday first) on this device's clock. */
function thisWeek(): Record<DayName, string> {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const out = {} as Record<DayName, string>;
  WEEK.forEach((day, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    out[day] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  return out;
}

/** A dated row's windows on one date: the hours a period gives that day of THIS week. */
function datedWindows(spec: AvailabilitySpec, day: DayName, date: string): [string, string][] {
  const rules = [
    ...(spec.weekly ?? []).filter((r) => (r.valid_from || r.valid_until) && (!r.valid_from || r.valid_from <= date) && (!r.valid_until || r.valid_until >= date)),
    ...(spec.periods ?? []).filter((p) => p.from <= date && p.to >= date).flatMap((p) => p.weekly),
  ];

  return rules
    .filter((r) => r.days.includes(day))
    .map((r) => [r.start, r.end] as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * The shape of the week at a glance: each day's open hours on one 24-hour track. With `dated`
 * (hours only for a set period) it is THIS week's hours from whichever periods cover each day.
 */
export function WeekRibbon({ spec, dated = false }: { spec: AvailabilitySpec; dated?: boolean }) {
  const { labels } = useCalendarUi();
  const [dates] = useState(thisWeek);

  return (
    <figure className="cal-avail__ribbon" aria-label={dated ? labels.availRibbonThisWeek : labels.availRibbon}>
      {WEEK.map((day) => {
        const windows = dated ? datedWindows(spec, day, dates[day]) : dayWindows(spec, day);

        return (
          <div key={day} className="cal-avail__ribbon-row">
            <span className="cal-avail__ribbon-day">{labels.availDayNames[day].slice(0, 3)}</span>
            <span className="cal-avail__ribbon-track" aria-hidden="true">
              {bars(windows.map(([s, e]) => [s, e] as [string, string])).map((b, i) => (
                <span key={i} className="cal-avail__ribbon-bar" style={{ left: `${b.left}%`, width: `${b.width}%` }} />
              ))}
            </span>
            <span className="cal-avail__ribbon-text">
              {windows.length ? windows.map(([s, e]) => `${s}-${e}`).join(', ') : labels.availDayOff}
            </span>
          </div>
        );
      })}
      <div className="cal-avail__ribbon-scale" aria-hidden="true">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </figure>
  );
}
