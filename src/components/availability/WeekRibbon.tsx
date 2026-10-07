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

/** The shape of the week at a glance: each day's open hours on one 24-hour track. */
export function WeekRibbon({ spec }: { spec: AvailabilitySpec }) {
  const { labels } = useCalendarUi();

  return (
    <figure className="cal-avail__ribbon" aria-label={labels.availRibbon}>
      {WEEK.map((day) => {
        const windows = dayWindows(spec, day);

        return (
          <div key={day} className="cal-avail__ribbon-row">
            <span className="cal-avail__ribbon-day">{labels.availDayNames[day].slice(0, 3)}</span>
            <span className="cal-avail__ribbon-track" aria-hidden="true">
              {bars(windows).map((b, i) => (
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
