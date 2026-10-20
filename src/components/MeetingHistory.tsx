import { cx, useCalendarUi } from '../theme';
import { formatZonedDateTime } from '../zoned';

/**
 * One thing that happened to a meeting, as calendar-service recorded it (calendar-client
 * `history()`). The product turns the service's actor into the person's name (`by`): only it knows
 * who `portify:user:4` is, and what this viewer may be told.
 */
export interface MeetingHistoryEntry {
  /** The service's event: created, confirmed, approved, declined, rescheduled, proposal_accepted, cancelled, rebooked. */
  event: string;
  /** When it happened (ISO instant). */
  at: string;
  /** Who did it, already a name for this viewer; null when nobody is named (the system, a guest). */
  by?: string | null;
  reason?: string | null;
  /** A move: where it was and where it went (ISO instants). */
  from_start_utc?: string | null;
  to_start_utc?: string | null;
}

/** The events a person reads as the meeting's story; everything else (holds, attendance) is not. */
const SHOWN = ['created', 'confirmed', 'approved', 'declined', 'rescheduled', 'proposal_accepted', 'cancelled', 'rebooked'];

/**
 * "Booked on …", "Rescheduled on … by …, from … to …", "Cancelled on … by …: reason": the one record
 * of what happened to a meeting, on the viewer's clock. Renders nothing when there is nothing to say.
 */
export function MeetingHistory({ entries, timezone, className }: { entries: MeetingHistoryEntry[]; timezone: string; className?: string }) {
  const { labels, classNames } = useCalendarUi();

  // A booking is made once: "created" and its "confirmed" are one event to a person.
  let booked = false;
  const shown = entries.filter((e) => {
    if (!SHOWN.includes(e.event) || labels.meetingHistoryEvent(e.event) === null) return false;
    if (e.event === 'created' || e.event === 'confirmed') {
      if (booked) return false;
      booked = true;
    }
    return true;
  });
  if (shown.length === 0) return null;

  return (
    <section className={cx('cal-meeting-side', classNames.meeting, className)} aria-label={labels.meetingHistory}>
      <p className="cal-meeting-side__title">{labels.meetingHistory}</p>
      <ol className="cal-history">
        {shown.map((e, i) => (
          <li key={`${e.event}-${e.at}-${i}`} className="cal-history__item">
            <p className="cal-history__what">
              {labels.meetingHistoryLine(labels.meetingHistoryEvent(e.event) as string, formatZonedDateTime(e.at, timezone), e.by ?? null)}
            </p>
            {e.from_start_utc && e.to_start_utc && (
              <p className="cal-history__detail">
                {labels.meetingHistoryMoved(formatZonedDateTime(e.from_start_utc, timezone), formatZonedDateTime(e.to_start_utc, timezone))}
              </p>
            )}
            {/* A rebook's "reason" is the service's note of who asked (booker / host), not words for a person. */}
            {e.reason && e.event !== 'rebooked' && <p className="cal-history__detail">{labels.meetingHistoryReason(e.reason)}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
