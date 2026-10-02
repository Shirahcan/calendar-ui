import { TZDate } from '@date-fns/tz';
import { addDays, addMonths, addWeeks, differenceInMinutes, endOfMonth, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { CalendarItem, ServiceEvent, Slot, View } from './types';

/**
 * Every calculation here takes an explicit IANA zone. Nothing reads the machine's zone:
 * a browser in Lagos rendering a Toronto consultant's week must still draw Toronto's.
 */

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface GridDay {
  /** Local Y-m-d in the grid's zone: the stable key for a day. */
  key: string;
  /** Local midnight of that day, as an instant. */
  start: Date;
  /** The next local midnight (23 or 25 hours later on a DST day). */
  end: Date;
  inMonth: boolean;
  isToday: boolean;
}

export function inZone(date: Date | string | number, zone: string): TZDate {
  return new TZDate(new Date(date).getTime(), zone);
}

/** Y-m-d of an instant, read in `zone`. */
export function dayKey(date: Date | string | number, zone: string): string {
  return format(inZone(date, zone), 'yyyy-MM-dd');
}

export function formatIn(date: Date | string | number, zone: string, pattern: string): string {
  return format(inZone(date, zone), pattern);
}

/** Minutes since local midnight of the instant, in `zone`. */
export function minutesIntoDay(date: Date | string | number, zone: string): number {
  const local = inZone(date, zone);

  return differenceInMinutes(local, startOfDay(local));
}

/**
 * `local` is a TZDate at runtime (date-fns keeps the instance type through addDays and
 * startOfWeek), so startOfDay and format below work in its zone; it is typed as Date only
 * because date-fns' generics widen it on the way through.
 */
function day(local: Date, anchorMonth: number, todayKey: string): GridDay {
  const start = startOfDay(local);
  const key = format(start, 'yyyy-MM-dd');

  return {
    key,
    start: new Date(start.getTime()),
    end: new Date(startOfDay(addDays(start, 1)).getTime()),
    inMonth: start.getMonth() === anchorMonth,
    isToday: key === todayKey,
  };
}

/** The days a view shows around `anchor`, in `zone`. Month grids are whole weeks. */
export function gridDays(view: View, anchor: Date, zone: string, weekStartsOn: WeekStart = 1, now: Date = new Date()): GridDay[] {
  const local = inZone(anchor, zone);
  const todayKey = dayKey(now, zone);

  if (view === 'day') {
    return [day(local, local.getMonth(), todayKey)];
  }

  if (view === 'week') {
    const first = startOfWeek(local, { weekStartsOn });

    return Array.from({ length: 7 }, (_, i) => day(addDays(first, i), local.getMonth(), todayKey));
  }

  const first = startOfWeek(startOfMonth(local), { weekStartsOn });
  const last = endOfMonth(local);
  const days: GridDay[] = [];
  for (let d = first; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) {
    days.push(day(d, local.getMonth(), todayKey));
  }

  return days;
}

/** Move the anchor one view-length forward (+1) or back (-1). */
export function shiftAnchor(view: View, anchor: Date, zone: string, step: 1 | -1): Date {
  const local = inZone(anchor, zone);
  const moved = view === 'month' ? addMonths(local, step) : view === 'week' ? addWeeks(local, step) : addDays(local, step);

  return new Date(moved.getTime());
}

/** Group slots by the VIEWER's local day, in order. */
export function slotsByDay(slots: Slot[], zone: string): Map<string, Slot[]> {
  const out = new Map<string, Slot[]>();
  for (const slot of [...slots].sort((a, b) => a.start_utc.localeCompare(b.start_utc))) {
    const key = dayKey(slot.start_utc, zone);
    out.set(key, [...(out.get(key) ?? []), slot]);
  }

  return out;
}

/**
 * The service's events as drawable items. Another product's booking and external busy
 * become a nameless "Busy" block: the privacy line is the service's, and this keeps it.
 */
export function eventsToItems(events: ServiceEvent[], labels: { busy?: string; untitled?: string } = {}): CalendarItem[] {
  return events.map((e, i) => e.kind === 'booking'
    ? { id: e.booking.id, start: new Date(e.booking.start_utc), end: new Date(e.booking.end_utc), title: e.booking.title || labels.untitled || 'Booking', layer: 'booking', data: e.booking }
    : { id: `busy-${i}-${e.start_utc}`, start: new Date(e.start_utc), end: new Date(e.end_utc), title: labels.busy ?? 'Busy', layer: 'busy' });
}

/** Items that touch a given grid day. */
export function itemsOn(items: CalendarItem[], day: GridDay): CalendarItem[] {
  return items.filter((it) => it.start < day.end && it.end > day.start);
}
