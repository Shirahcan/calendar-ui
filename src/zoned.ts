import { dayKey } from './time';

/**
 * Times as people read them: on one clock, and always saying which.
 *
 * Estate rule (2026-10-04): a product shows dates and times on the viewer's clock (see
 * useDisplayTimezone) and ALWAYS labels the zone, so nobody has to guess or convert. A bare
 * "8:25 PM" is how a client read a UTC-rendered "7:25 PM" as Lagos time and thought their call
 * had moved. Emails and calendar files use the person's profile zone; that is server side.
 *
 * Every helper takes an instant and the zone to read it in. Nothing reads the machine's zone.
 */

export type Instant = string | number | Date;

const asDate = (value: Instant): Date => (value instanceof Date ? value : new Date(value));

/** The zone's short name at that instant: "EDT", "WAT", or "GMT+1" where no name exists. */
export function zoneLabel(value: Instant, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(asDate(value));

  return parts.find((p) => p.type === 'timeZoneName')?.value ?? zone;
}

/** "8:25 PM GMT+1" */
export function formatZonedTime(value: Instant, zone: string): string {
  return asDate(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' });
}

/** "8:25 PM - 8:55 PM GMT+1": the zone once, at the end. */
export function formatZonedTimeRange(start: Instant, end: Instant, zone: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: zone };

  return `${asDate(start).toLocaleTimeString('en-US', opts)} - ${asDate(end).toLocaleTimeString('en-US', opts)} ${zoneLabel(end, zone)}`;
}

export type DateStyle = 'long' | 'medium' | 'short';

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  medium: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
  short: { month: 'short', day: 'numeric' },
};

/** "Wednesday, October 7, 2026" on the zone's calendar. A date alone: pair it with a labelled time. */
export function formatZonedDate(value: Instant, zone: string, style: DateStyle = 'long'): string {
  return asDate(value).toLocaleDateString('en-US', { ...DATE_STYLES[style], timeZone: zone });
}

/** "Wed, Oct 7, 2026, 8:25 PM GMT+1" */
export function formatZonedDateTime(value: Instant, zone: string, style: DateStyle = 'medium'): string {
  return `${formatZonedDate(value, zone, style)}, ${formatZonedTime(value, zone)}`;
}

/**
 * Only the items that are ON `day` (Y-m-d) on the viewer's clock. A booking screen lists slots
 * under the date the viewer picked; anything not on it must never be offered there, or a
 * client books a day they did not choose.
 */
export function onDay<T>(items: T[], day: string, zone: string, startOf: (item: T) => Instant): T[] {
  return items.filter((item) => dayKey(asDate(startOf(item)), zone) === day);
}
