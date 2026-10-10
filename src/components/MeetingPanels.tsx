import type { ReactNode } from 'react';
import { cx, useCalendarUi } from '../theme';
import { formatZonedDate, formatZonedDateTime, formatZonedTime, formatZonedTimeRange, zoneLongName } from '../zoned';

/**
 * The meeting page's panels, shared by every product (plan MP1). Each is presentational: the
 * product maps its meeting into `MeetingView` and arranges the panels in its own page, with its
 * own chrome and theme. The pieces that need a product's own data (notes, the call's transcript)
 * are their own components (MeetingNotesPanel, video-embed's panels).
 */
export interface MeetingView {
  title: string;
  /** The product's status word, and how it reads ("Scheduled", "No show"). */
  status: string;
  statusLabel: string;
  start_utc: string;
  end_utc: string;
  /** Where it happens: "Portify video room", "Phone call", "In person". */
  where: string;
  /** Has a video room the person joins from this page. */
  video: boolean;
  /** Still live (not ended, not cancelled). */
  live: boolean;
  join_opens_at?: string | null;
  join_closes_at?: string | null;
  about?: string | null;
  cancellation_reason?: string | null;
  booked_at?: string | null;
  /**
   * Who is on the call. `attendance` (after the call) or else `response` (before it) shows as a
   * small status beside the name: who came, or who has answered.
   */
  people: Array<{ role: string; name: string; email?: string | null; response?: string | null; attendance?: string | null }>;
}

/** What the meeting link means right now: open, when it opens, or why there is none. */
export function meetingLinkState(m: MeetingView, nowMs: number, zone: string, labels: ReturnType<typeof useCalendarUi>['labels']): { value: string; hint?: string } {
  if (!m.video) return { value: labels.meetingLinkNone, hint: labels.meetingLinkNoneHint };
  if (!m.live) return { value: labels.meetingLinkClosed };
  const opens = m.join_opens_at ? new Date(m.join_opens_at).getTime() : null;
  const closes = m.join_closes_at ? new Date(m.join_closes_at).getTime() : null;
  if (opens !== null && nowMs < opens) {
    const lead = Math.round((new Date(m.start_utc).getTime() - opens) / 60000);
    return { value: labels.meetingLinkOpensAt(formatZonedTime(opens, zone)), hint: labels.meetingLinkOpensHint(lead) };
  }
  if (closes !== null && nowMs >= closes) return { value: labels.meetingLinkClosed };

  return { value: labels.meetingLinkOpen, hint: labels.meetingLinkOpenHint };
}

function Row({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="cal-meeting__row">
      <p className="cal-meeting__label">{icon}{label}</p>
      <p className="cal-meeting__value">{value}</p>
      {hint && <p className="cal-meeting__hint">{hint}</p>}
    </div>
  );
}

export interface MeetingSummaryProps {
  meeting: MeetingView;
  timezone: string;
  /** The current time (ms), from the product, so the panel stays pure. */
  now: number;
  /** Product slots: icons per row, a status pill class, extra content under the rows. */
  icons?: Partial<Record<'date' | 'time' | 'where' | 'link', ReactNode>>;
  statusClassName?: string;
  /**
   * The link row's "join from this page" hint. Off where joining happens elsewhere (the quick
   * view, whose own button says where to go), or the hint points at the wrong screen.
   */
  linkHint?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Status, date, time, where, the meeting link's state, what it is about, why it was cancelled. */
export function MeetingSummary({ meeting: m, timezone, now, icons = {}, statusClassName, linkHint = true, children, className }: MeetingSummaryProps) {
  const { labels, classNames } = useCalendarUi();
  const link = meetingLinkState(m, now, timezone, labels);

  return (
    <section className={cx('cal-meeting', classNames.meeting, className)} aria-label={m.title}>
      <span className={cx('cal-meeting__status', statusClassName)} data-status={m.status}>{m.statusLabel}</span>
      <div className="cal-meeting__grid">
        <Row label={labels.meetingDate} value={formatZonedDate(m.start_utc, timezone, 'long')} icon={icons.date} />
        <Row label={labels.meetingTime} value={formatZonedTimeRange(m.start_utc, m.end_utc, timezone)} icon={icons.time} />
        <Row label={labels.meetingWhere} value={m.where} icon={icons.where} />
        <Row label={labels.meetingLink} value={link.value} hint={linkHint ? link.hint : undefined} icon={icons.link} />
      </div>
      {m.about && (
        <div className="cal-meeting__about">
          <p className="cal-meeting__label">{labels.meetingAbout}</p>
          <p className="cal-meeting__text">{m.about}</p>
        </div>
      )}
      {m.cancellation_reason && (
        <div className="cal-meeting__cancelled" role="note">
          <p className="cal-meeting__label">{labels.meetingCancelReason}</p>
          <p className="cal-meeting__text">{m.cancellation_reason}</p>
        </div>
      )}
      {children}
    </section>
  );
}

/** Who the meeting is for. */
export function MeetingPeople({ meeting, avatar, className }: { meeting: MeetingView; avatar?: ReactNode; className?: string }) {
  const { labels, classNames } = useCalendarUi();

  return (
    <section className={cx('cal-meeting-side', classNames.meeting, className)} aria-label={labels.meetingPeople}>
      <p className="cal-meeting-side__title">{labels.meetingPeople}</p>
      {meeting.people.map((p) => (
        <div key={`${p.role}-${p.name}`} className="cal-meeting-side__person">
          {avatar}
          <div className="cal-meeting-side__who">
            <p className="cal-meeting__label">{p.role}</p>
            <p className="cal-meeting-side__name">{p.name}</p>
            {p.email && <p className="cal-meeting-side__email">{p.email}</p>}
            {(() => {
              const state = p.attendance ? labels.meetingAttendance(p.attendance) : p.response ? labels.meetingResponse(p.response) : null;
              const key = p.attendance ?? p.response;
              return state ? <p className="cal-meeting-side__state" data-state={key ?? undefined}>{state}</p> : null;
            })()}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Length, which clock the page is on (named in full), when it was booked. */
export function MeetingDetails({ meeting: m, timezone, className }: { meeting: MeetingView; timezone: string; className?: string }) {
  const { labels, classNames } = useCalendarUi();
  const minutes = Math.round((new Date(m.end_utc).getTime() - new Date(m.start_utc).getTime()) / 60000);

  return (
    <section className={cx('cal-meeting-side', classNames.meeting, className)} aria-label={labels.meetingDetails}>
      <p className="cal-meeting-side__title">{labels.meetingDetails}</p>
      <Row label={labels.meetingLength} value={labels.meetingMinutes(minutes)} />
      <Row label={labels.meetingTimesShownIn} value={zoneLongName(m.start_utc, timezone)} />
      {m.booked_at && <Row label={labels.meetingBooked} value={formatZonedDateTime(m.booked_at, timezone)} />}
    </section>
  );
}

export interface MeetingAction {
  key: string;
  label: string;
  onSelect: () => void;
  primary?: boolean;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

/** The things the viewer may do to the meeting (the product decides which: confirm, cancel, its own). */
export function MeetingActions({ actions, className }: { actions: MeetingAction[]; className?: string }) {
  const { labels, classNames } = useCalendarUi();
  if (actions.length === 0) return null;

  return (
    <section className={cx('cal-meeting-side', classNames.meeting, className)} aria-label={labels.meetingActions}>
      <p className="cal-meeting-side__title">{labels.meetingActions}</p>
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          className={cx('cal-btn', 'cal-meeting-side__action', a.primary && 'cal-btn--primary', a.danger && 'cal-meeting-side__action--danger', classNames.button, a.primary && classNames.buttonPrimary)}
          disabled={a.disabled || a.busy}
          onClick={a.onSelect}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </section>
  );
}
