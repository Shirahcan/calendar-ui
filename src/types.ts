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
  /** Minutes kept free around each meeting on these days, when it differs from the schedule's buffer. */
  gap?: number;
  /**
   * The meeting length these hours offer, when it is not the booking type's (a 60-minute interview
   * morning beside 30-minute afternoons). Read only by a type with `length_from_windows`.
   */
  length?: number;
}

/** The schema-1 availability spec the service stores (04-availability-spec-and-engine.md). */
export interface AvailabilitySpec {
  schema: 1;
  timezone: { zone: string; follow_host_profile?: boolean };
  /** Minutes kept free around every meeting on a day that sets no `gap` of its own. */
  buffer?: number;
  weekly?: WeeklyRule[];
  periods?: { from: string; to: string; weekly: WeeklyRule[] }[];
  dates?: { date: string; windows: [string, string][]; length?: number }[];
  overrides?: { date: string; windows: [string, string][]; gap?: number; length?: number }[];
  blocks?: ({ from: string; to: string } | { start: string; end: string })[];
  /** Close on the region's public holidays (the service holds the dates), except the dates in `work`. */
  holidays?: { region: string; observe: boolean; work?: string[] };
}

/** How a product's bookings are scheduled (calendar-service GET /v1/scheduling/policy). */
export interface SchedulingPolicy {
  min_buffer_minutes: number;
  max_buffer_minutes: number;
  default_buffer_minutes: number;
  buffer_choices: number[];
  /** The meeting lengths offered (a window's own length is one of these). */
  duration_choices?: number[];
  min_notice_minutes: number;
  horizon_days: number;
  hold_seconds: number;
  /** The week a new person starts with; its rows also give the hours a day gets when turned on. */
  seed_weekly: WeeklyRule[];
  observe_holidays_by_default: boolean;
  /** Erase an ended booking (its notes, pads and people) this many days after it ended; null keeps it. */
  erase_ended_bookings_after_days?: number | null;
  /** The call tools people may connect instead of the product's own room. */
  call_tools_offered?: Array<'zoom' | 'google_meet'>;
  /** The tool a backup call is made on when a call's own room cannot be rescued; null = none. */
  backup_call_tool?: 'google_meet' | null;
}

/** What the server can actually offer right now (the policy less what is not configured). */
export interface SchedulingOffered {
  call_tools: Array<'zoom' | 'google_meet'>;
  calendar_providers: Array<'google' | 'microsoft'>;
  backup_call?: { tool: 'google_meet' | null; ready: boolean; reason: string | null };
}

/** A place with public holidays (calendar-service GET /v1/holidays/regions). */
export interface HolidayRegion {
  code: string;
  name: string;
  active?: boolean;
}

export type View = 'month' | 'week' | 'day';
