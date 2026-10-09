import { TZDate } from '@date-fns/tz';
import { dayKey } from './time';
import { ZONE_ABBREVIATIONS } from './zoneAbbreviations';

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

const tzPart = (value: Instant, zone: string, style: 'short' | 'long'): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: style })
    .formatToParts(asDate(value))
    .find((p) => p.type === 'timeZoneName')?.value ?? zone;

/** Minutes east of UTC for `zone` at `date`. */
const offsetMinutes = (date: Date, zone: string): number => {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
};

/** On summer time at that instant: its offset is above the zone's standard (the lower of January and July). */
const onDaylightTime = (date: Date, zone: string): boolean => {
  const y = date.getUTCFullYear();
  const standard = Math.min(offsetMinutes(new Date(Date.UTC(y, 0, 1)), zone), offsetMinutes(new Date(Date.UTC(y, 6, 1)), zone));
  return offsetMinutes(date, zone) > standard;
};

/**
 * The zone's SHORT NAME at that instant (owner 2026-10-09: "WAT", never "West Africa Time"):
 * ICU's English abbreviation where there is one ("EDT", "PST", "GMT", "UTC"), else the curated
 * one (ZONE_ABBREVIATIONS: "WAT", "IST", "CEST", "AEDT"), else ICU's offset ("GMT+5") for a zone
 * nobody has named. calendar-client's ZonedTime applies the same rule and table, so a screen and
 * an email say the same thing.
 */
export function zoneLabel(value: Instant, zone: string): string {
  const short = tzPart(value, zone, 'short');
  if (!/^(GMT|UTC)[+-]/.test(short)) return short;
  const known = ZONE_ABBREVIATIONS[zone];
  if (!known) return short;

  return known[1] && onDaylightTime(asDate(value), zone) ? known[1] : known[0];
}

/** The zone's full name ("West Africa Standard Time"), for a sentence that names it ("Times shown in"). */
export function zoneLongName(value: Instant, zone: string): string {
  return tzPart(value, zone, 'long');
}

/** "8:25 PM EDT", "8:25 PM WAT" */
export function formatZonedTime(value: Instant, zone: string): string {
  return `${asDate(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })} ${zoneLabel(value, zone)}`;
}

/** "8:25 PM - 8:55 PM WAT": the zone once, at the end. */
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

/** "Wed, Oct 7, 2026, 8:25 PM EDT" */
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

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * A wall time typed on `zone`'s clock ("2026-10-07T20:25", what a datetime-local input holds)
 * as the instant it names, ISO UTC. Null when the text is not a wall time. A datetime-local
 * value sent as-is carries no zone at all, so a server reads it on ITS clock: a Lagos
 * consultant's "8:25 PM" became 8:25 PM UTC.
 */
export function wallTimeToInstant(wall: string, zone: string): string | null {
  const m = WALL.exec(wall.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];

  return new Date(new TZDate(y, mo - 1, d, h, mi, zone).getTime()).toISOString();
}

/** The instant on `zone`'s clock as a datetime-local value ("2026-10-07T20:25"). */
export function instantToWallTime(value: Instant, zone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(asDate(value))
      .map((p) => [p.type, p.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "America/Toronto" -> "Toronto", "America/Argentina/Buenos_Aires" -> "Buenos Aires". */
export function zoneCity(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

const offsetAt = (instant: number, zone: string): number => {
  const wall = instantToWallTime(instant, zone);
  const asUtc = Date.UTC(+wall.slice(0, 4), +wall.slice(5, 7) - 1, +wall.slice(8, 10), +wall.slice(11, 13), +wall.slice(14, 16));

  return Math.round((asUtc - Math.floor(instant / 60000) * 60000) / 60000);
};

/**
 * True when two zones read the same clock now and half a year from now (so both DST seasons):
 * Toronto and New York do, Toronto and Lagos do not. Used to decide whether a difference
 * between zones is one a person would notice.
 */
export function sameClock(a: string, b: string, now: number = Date.now()): boolean {
  if (a === b) return true;
  const later = now + 182 * 24 * 3600 * 1000;

  return offsetAt(now, a) === offsetAt(now, b) && offsetAt(later, a) === offsetAt(later, b);
}
