/**
 * Shapes shared with calendar-service (portify docs/plans/calendar-service-2026-10-02).
 * Every instant is an ISO 8601 UTC string, exactly as the service returns it.
 */

export interface Slot {
  start_utc: string;
  end_utc: string;
  host_ids: string[];
}

export type BookingState =
  | 'held' | 'pending_approval' | 'confirmed' | 'declined'
  | 'released' | 'expired' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  state: BookingState;
  start_utc: string;
  end_utc: string;
  hold_expires_at: string | null;
  hosts: string[];
  title?: string | null;
  product_ref?: string | null;
  [key: string]: unknown;
}

/** What the events feed returns: own bookings in full, everything else as anonymous busy. */
export type ServiceEvent =
  | { kind: 'booking'; booking: Booking }
  | { kind: 'busy'; source: 'booking' | 'external'; start_utc: string; end_utc: string };

/** One item drawn on a grid, from the service or from a product layer. */
export interface CalendarItem {
  id: string;
  start: Date;
  end: Date;
  title: string;
  /** 'booking' | 'busy' | a product layer id */
  layer: string;
  allDay?: boolean;
  color?: string;
  data?: unknown;
}

/** A product-supplied overlay (Portify deadlines, MployNow job starts). Never stored in the service. */
export interface Layer {
  id: string;
  label: string;
  color: string;
  fetch: (range: { from: Date; to: Date }) => Promise<CalendarItem[]>;
}

export type DayName = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface WeeklyRule {
  days: DayName[];
  start: string;
  end: string;
  valid_from?: string | null;
  valid_until?: string | null;
}

/** The schema-1 availability spec the service stores (04-availability-spec-and-engine.md). */
export interface AvailabilitySpec {
  schema: 1;
  timezone: { zone: string; follow_host_profile?: boolean };
  weekly?: WeeklyRule[];
  periods?: { from: string; to: string; weekly: WeeklyRule[] }[];
  dates?: { date: string; windows: [string, string][] }[];
  overrides?: { date: string; windows: [string, string][] }[];
  blocks?: ({ from: string; to: string } | { start: string; end: string })[];
  holidays?: { region: string; observe: boolean };
}

export type View = 'month' | 'week' | 'day';
