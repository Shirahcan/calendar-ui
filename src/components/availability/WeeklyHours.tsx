import type { AvailabilitySpec, DayName, SchedulingPolicy } from '../../types';
import { dayGap, dayWindows, type EditorAction } from '../../hooks/useAvailabilityEditor';
import { cx, useCalendarUi } from '../../theme';
import { WEEK, minutesOf } from './WeekRibbon';

/**
 * The hours a day gets when it is turned on: the product's seed week for that day, else its first
 * seed row (the policy always has one), so no time of day is written into the component.
 */
function seedWindow(policy: SchedulingPolicy, day: DayName): [string, string] {
  const row = policy.seed_weekly.find((r) => r.days.includes(day)) ?? policy.seed_weekly[0];

  return row ? [row.start, row.end] : ['', ''];
}

/** The next window after the day's last one: an hour later, as long as the seed window. */
function nextWindow(windows: [string, string][], seed: [string, string]): [string, string] {
  if (windows.length === 0) return seed;
  const length = Math.max(minutesOf(seed[1]) - minutesOf(seed[0]), 60);
  const end = minutesOf(windows[windows.length - 1]![1]);
  const start = Math.min(end + 60, 23 * 60);
  const stop = Math.min(start + length, 24 * 60 - 1);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return [fmt(start), fmt(stop)];
}

/** One row per weekday: open or not, each window it is open for, and its own buffer if it has one. */
export function WeeklyHours({ spec, policy, edit, disabled, dayBuffers = true }: {
  spec: AvailabilitySpec;
  policy: SchedulingPolicy;
  edit: (a: EditorAction) => void;
  disabled?: boolean;
  /** Show each day's own break (off where the week is a template, e.g. the policy's seed week). */
  dayBuffers?: boolean;
}) {
  const { labels, classNames } = useCalendarUi();
  const btn = cx('cal-btn', classNames.button);
  const scheduleBuffer = spec.buffer ?? policy.default_buffer_minutes;

  return (
    <div className="cal-avail__days">
      {WEEK.map((day) => {
        const windows = dayWindows(spec, day);
        const name = labels.availDayNames[day];
        const gap = dayGap(spec, day);
        const set = (next: [string, string][]) => edit({ type: 'setDayWindows', day, windows: next });
        const choices = gap === undefined || policy.buffer_choices.includes(gap) ? policy.buffer_choices : [...policy.buffer_choices, gap].sort((a, b) => a - b);

        return (
          <div key={day} className={cx('cal-avail__day', windows.length === 0 && 'cal-avail__day--off')}>
            <label className="cal-avail__day-name">
              <input
                type="checkbox"
                checked={windows.length > 0}
                disabled={disabled}
                aria-label={labels.availOpenDay(name)}
                onChange={(e) => set(e.target.checked ? [seedWindow(policy, day)] : [])}
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
              {dayBuffers && windows.length > 0 ? (
                <label className="cal-avail__day-gap">
                  <span>{labels.availDayBuffer}</span>
                  <select
                    className="cal-input"
                    value={gap === undefined ? '' : String(gap)}
                    disabled={disabled}
                    aria-label={labels.availDayBufferFor(name)}
                    onChange={(ev) => edit({ type: 'setDayGap', day, minutes: ev.target.value === '' ? null : Number(ev.target.value) })}
                  >
                    <option value="">{labels.availBufferSameAsDefault(scheduleBuffer)}</option>
                    {choices.map((m) => (
                      <option key={m} value={String(m)}>{labels.availMinutes(m)}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="button" className={btn} disabled={disabled} onClick={() => set([...windows, nextWindow(windows, seedWindow(policy, day))])}>
                {labels.availAddHours}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
