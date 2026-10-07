import type { AvailabilitySpec, DayName } from '../../types';
import { dayWindows, type EditorAction } from '../../hooks/useAvailabilityEditor';
import { cx, useCalendarUi } from '../../theme';
import { WEEK, minutesOf } from './WeekRibbon';

const WEEKDAYS: DayName[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

/** The next sensible window after the day's last one (an hour later, three hours long). */
function nextWindow(windows: [string, string][]): [string, string] {
  if (windows.length === 0) return ['09:00', '17:00'];
  const end = minutesOf(windows[windows.length - 1]![1]);
  const start = Math.min(end + 60, 23 * 60);
  const stop = Math.min(start + 180, 24 * 60 - 1);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return [fmt(start), fmt(stop)];
}

/** One row per weekday: open or not, and each window it is open for. */
export function WeeklyHours({ spec, edit, disabled }: { spec: AvailabilitySpec; edit: (a: EditorAction) => void; disabled?: boolean }) {
  const { labels, classNames } = useCalendarUi();
  const btn = cx('cal-btn', classNames.button);

  return (
    <div className="cal-avail__days">
      {WEEK.map((day) => {
        const windows = dayWindows(spec, day);
        const name = labels.availDayNames[day];
        const set = (next: [string, string][]) => edit({ type: 'setDayWindows', day, windows: next });

        return (
          <div key={day} className={cx('cal-avail__day', windows.length === 0 && 'cal-avail__day--off')}>
            <label className="cal-avail__day-name">
              <input
                type="checkbox"
                checked={windows.length > 0}
                disabled={disabled}
                aria-label={labels.availOpenDay(name)}
                onChange={(e) => set(e.target.checked ? [nextWindow([])] : [])}
              />
              <span>{name}</span>
            </label>

            <div className="cal-avail__windows">
              {windows.length === 0 ? <span className="cal-avail__off">{labels.availDayOff}</span> : null}
              {windows.map(([s, e], i) => (
                <div key={`${s}-${e}-${i}`} className="cal-avail__window">
                  <input
                    className="cal-input"
                    type="time"
                    step={900}
                    value={s}
                    disabled={disabled}
                    aria-label={`${name} ${labels.availFrom}`}
                    onChange={(ev) => set(windows.map((w, j) => (j === i ? [ev.target.value, w[1]] : w)))}
                  />
                  <span className="cal-avail__dash" aria-hidden="true">-</span>
                  <input
                    className="cal-input"
                    type="time"
                    step={900}
                    value={e}
                    disabled={disabled}
                    aria-label={`${name} ${labels.availTo}`}
                    onChange={(ev) => set(windows.map((w, j) => (j === i ? [w[0], ev.target.value] : w)))}
                  />
                  <button
                    type="button"
                    className="cal-avail__x"
                    disabled={disabled}
                    aria-label={labels.availRemoveHours(name, s, e)}
                    onClick={() => set(windows.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="cal-avail__day-actions">
              <button type="button" className={btn} disabled={disabled} onClick={() => set([...windows, nextWindow(windows)])}>
                {labels.availAddHours}
              </button>
              {windows.length > 0 ? (
                <button
                  type="button"
                  className={cx(btn, 'cal-btn--ghost')}
                  disabled={disabled}
                  onClick={() => edit({ type: 'copyDay', day, to: (WEEKDAYS.includes(day) ? WEEKDAYS : WEEK).filter((d) => d !== day) })}
                >
                  {WEEKDAYS.includes(day) ? labels.availCopyWeekdays : labels.availCopyAll}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
