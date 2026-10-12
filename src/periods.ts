import { minutesIntoDay } from './time';

/**
 * The parts of a day every product groups open times by, read on the VIEWER's clock: a time is
 * "evening" because it is evening for the person choosing it. One authority, so a client's booking
 * page, a consultant's reschedule and an admin's "New meeting" agree on where 6:30 PM belongs.
 */
export type DayPeriod = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';

/** In the order a day runs. `from` is the hour (0-23, viewer's clock) the period starts at. */
export const DAY_PERIODS: ReadonlyArray<{ period: DayPeriod; from: number }> = [
  { period: 'early_morning', from: 0 },
  { period: 'morning', from: 8 },
  { period: 'afternoon', from: 12 },
  { period: 'evening', from: 17 },
  { period: 'night', from: 21 },
];

export function dayPeriodOf(instant: Date | string | number, zone: string): DayPeriod {
  const hour = Math.floor(minutesIntoDay(instant, zone) / 60);
  let found: DayPeriod = 'early_morning';
  for (const { period, from } of DAY_PERIODS) {
    if (hour >= from) found = period;
  }

  return found;
}

/** The items by part of day, in day order, leaving out empty parts. Each part keeps its items' order. */
export function groupByDayPeriod<T>(items: T[], zone: string, startOf: (item: T) => Date | string | number): Array<{ period: DayPeriod; items: T[] }> {
  const by = new Map<DayPeriod, T[]>();
  for (const item of items) {
    const period = dayPeriodOf(startOf(item), zone);
    by.set(period, [...(by.get(period) ?? []), item]);
  }

  return DAY_PERIODS.filter(({ period }) => by.has(period)).map(({ period }) => ({ period, items: by.get(period)! }));
}
