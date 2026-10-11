import { useMemo, useState } from 'react';
import { addDays, addMonths, addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { gridDays, inZone, type GridDay, type WeekStart } from '../time';
import type { CalendarItem } from '../types';
import { cx, useCalendarUi } from '../theme';
import { MonthView } from './MonthView';
import { DayView, WeekView } from './WeekView';

export type MeetingCalendarView = 'month' | 'week' | 'day';

/** A meeting's state, as every product names it on a calendar. */
export type MeetingCalendarStatus =
  | 'pending_approval' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

/**
 * The one map from a meeting's state to its colour: the meetings are drawn with it and the legend
 * is built from it, so the two can never disagree.
 */
export const MEETING_STATUS_COLORS: Record<MeetingCalendarStatus, string> = {
  pending_approval: '#8b5cf6',
  scheduled: '#3b82f6',
  confirmed: '#22c55e',
  in_progress: '#eab308',
  completed: '#9ca3af',
  cancelled: '#ef4444',
  no_show: '#f97316',
  rescheduled: '#a855f7',
};

export interface MeetingCalendarMeeting<T = unknown> {
  id: string;
  start: Date | string;
  end: Date | string;
  title: string;
  status: MeetingCalendarStatus | string;
  /** The product's own record, handed back on click. */
  data?: T;
}

export interface MeetingCalendarProps<T = unknown> {
  meetings: MeetingCalendarMeeting<T>[];
  /** The person's time taken elsewhere (other products, a connected calendar): busy, never clickable. */
  busy?: { start: Date | string; end: Date | string }[];
  /** A connected calendar has not been read recently, so some busy time may be missing. */
  busyStale?: boolean;
  /** Show the "busy elsewhere" legend (the viewer is the person whose time it is). */
  showBusy?: boolean;
  /** The zone the times are shown in (the viewer's device clock, named). */
  zone: string;
  view: MeetingCalendarView;
  /** Omit to hide the Month / Week / Day switch. */
  onViewChange?: (view: MeetingCalendarView) => void;
  /** The day the calendar opens on. */
  initialDate?: Date;
  /** The visible period moved (previous, next, today): a product fetching a window follows it. */
  onPeriodChange?: (anchor: Date) => void;
  /** A day was picked (month view), `yyyy-MM-dd` in `zone`. */
  onSelectDay?: (day: string) => void;
  onMeetingClick: (meeting: MeetingCalendarMeeting<T>) => void;
  /** Nothing to show yet: the grid is replaced by a quiet placeholder, never while meetings are on screen. */
  loading?: boolean;
  weekStartsOn?: WeekStart;
  className?: string;
}

/**
 * Every product's meetings calendar: the period's title with previous / next / today, the
 * Month / Week / Day switch, the grid (MonthView / WeekView / DayView), and the legends. The product
 * passes its meetings and the person's busy time; it never draws any of this itself.
 */
export function MeetingCalendar<T = unknown>({
  meetings, busy = [], busyStale, showBusy, zone, view, onViewChange, initialDate, onPeriodChange, onSelectDay, onMeetingClick, loading,
  weekStartsOn = 0, className,
}: MeetingCalendarProps<T>) {
  const { labels } = useCalendarUi();
  const [anchor, setAnchor] = useState<Date>(() => initialDate ?? new Date());

  const days: GridDay[] = useMemo(() => gridDays(view, anchor, zone, weekStartsOn), [view, anchor, zone, weekStartsOn]);

  const items = useMemo<CalendarItem[]>(() => [
    ...busy.map((b, i) => ({ id: `busy-${i}`, start: new Date(b.start), end: new Date(b.end), title: labels.busyElsewhere, layer: 'busy' as const })),
    ...meetings.map((m) => ({
      id: m.id, start: new Date(m.start), end: new Date(m.end), title: m.title, layer: 'booking' as const,
      color: MEETING_STATUS_COLORS[m.status as MeetingCalendarStatus] ?? MEETING_STATUS_COLORS.scheduled, data: m,
    })),
  ], [meetings, busy, labels.busyElsewhere]);

  const move = (next: Date) => {
    setAnchor(next);
    onPeriodChange?.(next);
  };
  const step = (dir: 1 | -1) => move(view === 'month' ? addMonths(anchor, dir) : view === 'week' ? addWeeks(anchor, dir) : addDays(anchor, dir));

  const local = inZone(anchor, zone);
  const title = view === 'month'
    ? format(local, 'MMMM yyyy')
    : view === 'day'
      ? format(local, 'EEEE, MMMM d, yyyy')
      : labels.weekRange(format(startOfWeek(local, { weekStartsOn }), 'MMM d'), format(endOfWeek(local, { weekStartsOn }), 'MMM d, yyyy'));

  const click = (item: CalendarItem) => {
    if (item.layer === 'booking' && item.data) {
      onMeetingClick(item.data as MeetingCalendarMeeting<T>);
    }
  };

  const shownStatuses = (Object.keys(MEETING_STATUS_COLORS) as MeetingCalendarStatus[]);

  return (
    <div className={cx('cal-mcal', className)}>
      <div className="cal-mcal__bar">
        <div className="cal-mcal__nav">
          <button type="button" className="cal-mcal__step" onClick={() => step(-1)} aria-label={labels.previousPeriod(view)}><span aria-hidden="true">‹</span></button>
          <button type="button" className="cal-mcal__step" onClick={() => step(1)} aria-label={labels.nextPeriod(view)}><span aria-hidden="true">›</span></button>
          <h2 className="cal-mcal__title" aria-live="polite">{title}</h2>
        </div>
        <div className="cal-mcal__tools">
          <button type="button" className="cal-mcal__today" onClick={() => { const now = new Date(); move(now); onSelectDay?.(format(inZone(now, zone), 'yyyy-MM-dd')); }}>{labels.today}</button>
          {onViewChange && (
            <div className="cal-mcal__views" role="group" aria-label={labels.calendarView}>
              {(['month', 'week', 'day'] as const).map((v) => (
                <button type="button" key={v} aria-pressed={view === v} className={cx('cal-mcal__view', view === v && 'is-active')} onClick={() => onViewChange(v)}>
                  {labels.viewName(v)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && meetings.length === 0 ? (
        <div className="cal-mcal__placeholder" aria-busy="true">{labels.loadingCalendar}</div>
      ) : view === 'month' ? (
        <MonthView days={days} items={items} zone={zone} onSelectDay={(d) => onSelectDay?.(d.key)} onItemClick={click} />
      ) : view === 'week' ? (
        <WeekView days={days} items={items} zone={zone} onItemClick={click} />
      ) : (
        <DayView days={days} items={items} zone={zone} onItemClick={click} />
      )}

      {showBusy && (
        <p className="cal-mcal__busy">
          <span className="cal-mcal__busy-swatch" aria-hidden="true" />
          {labels.busyElsewhereLegend}
          {busyStale && <span className="cal-mcal__stale">{labels.busyStale}</span>}
        </p>
      )}
      <ul className="cal-mcal__legend" aria-label={labels.statusLegend}>
        {shownStatuses.map((s) => (
          <li key={s}><span className="cal-mcal__dot" style={{ background: MEETING_STATUS_COLORS[s] }} aria-hidden="true" />{labels.meetingStatus(s)}</li>
        ))}
      </ul>
    </div>
  );
}
