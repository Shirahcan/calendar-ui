import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSlots, type SlotFetcher } from '../hooks/useSlots';
import { cx, useCalendarUi } from '../theme';
import { dayKey, formatIn } from '../time';
import type { Slot } from '../types';
import { formatZonedDateTime, formatZonedTime, wallTimeToInstant } from '../zoned';
import { MeetingPeople, MeetingSummary, type MeetingAction, type MeetingView } from './MeetingPanels';
import { RowMenu } from './RowMenu';
import { SlotPicker } from './SlotPicker';

/**
 * One modal shell for the meeting dialogs: a native modal bounded to the viewport, header and
 * footer pinned, the body scrolls. Mounted = open, like PadReviewDialog; Escape and × close it.
 */
function ModalShell({ title, onClose, headSide, footer, children, className }: {
  title: string;
  onClose: () => void;
  headSide?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { labels } = useCalendarUi();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open && typeof d.showModal === 'function') d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={cx('cal-modal', className)}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="cal-modal__head">
        <h3>{title}</h3>
        <span className="cal-modal__headside">
          {headSide}
          <button type="button" className="cal-modal__close" aria-label={labels.quickViewClose} onClick={onClose}>×</button>
        </span>
      </header>
      <div className="cal-modal__body">{children}</div>
      {footer ? <footer className="cal-modal__foot">{footer}</footer> : null}
    </dialog>
  );
}

export interface MeetingQuickViewProps {
  meeting: MeetingView;
  timezone: string;
  /** The current time (ms), from the product, so the dialog stays pure. */
  now: number;
  /** Is the room open right now? Join is the one main action while it is. */
  roomOpen: boolean;
  onJoin: () => void;
  onOpenPage: () => void;
  /** Everything else the viewer may do (reschedule, cancel, the product's own), behind one kebab. */
  actions?: MeetingAction[];
  onClose: () => void;
  /** Product slots for the summary rows (icons) and its status pill. */
  icons?: Parameters<typeof MeetingSummary>[0]['icons'];
  statusClassName?: string;
  className?: string;
}

/**
 * The calendar's quick look at one meeting. ONE main action, chosen for the moment: Join while
 * the room is open, otherwise the meeting page (every detail, notes, its own Join). Any other
 * action sits behind one kebab, destructive ones last.
 */
export function MeetingQuickView({ meeting, timezone, now, roomOpen, onJoin, onOpenPage, actions = [], onClose, icons, statusClassName, className }: MeetingQuickViewProps) {
  const { labels, classNames } = useCalendarUi();
  const menu = actions.length > 0
    ? <RowMenu label={labels.quickViewMore} items={actions.map((a) => ({ label: a.label, onSelect: a.onSelect, danger: a.danger, disabled: a.disabled || a.busy }))} />
    : null;

  return (
    <ModalShell
      title={meeting.title}
      onClose={onClose}
      headSide={menu}
      className={className}
      footer={
        <button type="button" className={cx('cal-btn', 'cal-btn--primary', 'cal-modal__primary', classNames.button, classNames.buttonPrimary)} onClick={roomOpen ? onJoin : onOpenPage}>
          {roomOpen ? labels.quickViewJoin : labels.quickViewOpenPage}
        </button>
      }
    >
      <MeetingSummary meeting={meeting} timezone={timezone} now={now} icons={icons} statusClassName={statusClassName} linkHint={false} />
      {meeting.people.length > 0 && <MeetingPeople meeting={meeting} collapsible />}
    </ModalShell>
  );
}

export interface CancelMeetingDialogProps {
  title: string;
  /** Who hears about it, in the reader's words ("Maria Garcia", "your consultant"). */
  otherParty: string;
  /** The product's call. A rejection keeps the dialog open and shows why. */
  onCancel: (reason: string) => Promise<void>;
  onClose: () => void;
  describeError?: (error: unknown) => string;
}

/** Cancel a meeting with a reason the other side is told. */
export function CancelMeetingDialog({ title, otherParty, onCancel, onClose, describeError }: CancelMeetingDialogProps) {
  const { labels, classNames } = useCalendarUi();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = reason.trim().length >= 5;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCancel(reason.trim());
    } catch (err) {
      setError(describeError ? describeError(err) : err instanceof Error && err.message ? err.message : labels.cancelFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={labels.cancelTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cx('cal-btn', classNames.button)} onClick={onClose} disabled={busy}>{labels.cancelKeep}</button>
          <button type="button" className={cx('cal-btn', 'cal-btn--danger', classNames.button)} onClick={() => void submit()} disabled={!ok || busy}>
            {labels.cancelConfirm}
          </button>
        </>
      }
    >
      <p className="cal-modal__text"><strong>{title}</strong>. {labels.cancelWhoIsTold(otherParty)}</p>
      <label className="cal-modal__field">
        {labels.cancelReason}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} disabled={busy} />
        <span className="cal-modal__hint">{labels.cancelReasonHint}</span>
      </label>
      {error && <p className="cal-modal__error" role="alert">{error}</p>}
    </ModalShell>
  );
}

/** "2026-10-12" plus n days, as a calendar date (no clock, so no DST drift). */
function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];

  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export interface RescheduleDialogProps {
  title: string;
  /** The meeting's current start (UTC), said at the top so the person knows what they are moving. */
  currentStart: string;
  viewerZone: string;
  hostZone?: string;
  /** The product's call for open times (its backend asks the service), and the type it books. */
  fetcher: SlotFetcher;
  bookingType: string;
  /** The current time (ms), from the product. Days before today cannot be picked. */
  now: number;
  /** The product's call, with the new start as a UTC instant. A rejection keeps the dialog open. */
  onReschedule: (slot: Slot, reason: string) => Promise<void>;
  onClose: () => void;
  describeError?: (error: unknown) => string;
}

/**
 * Move a meeting to another OPEN time: a day at a time on the viewer's clock, picked from the
 * host's real availability, sent as a UTC instant. Never a free date and time box: that sent a
 * wall time with no zone and offered times nobody was free.
 */
export function RescheduleDialog({ title, currentStart, viewerZone, hostZone, fetcher, bookingType, now, onReschedule, onClose, describeError }: RescheduleDialogProps) {
  const { labels, classNames } = useCalendarUi();
  const today = dayKey(now, viewerZone);
  const [day, setDay] = useState(() => {
    const current = dayKey(currentStart, viewerZone);
    return current > today ? current : today;
  });
  const [picked, setPicked] = useState<Slot | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => new Date(wallTimeToInstant(`${day}T00:00`, viewerZone) ?? `${day}T00:00:00Z`), [day, viewerZone]);
  const to = useMemo(() => new Date(wallTimeToInstant(`${addDays(day, 1)}T00:00`, viewerZone) ?? `${addDays(day, 1)}T00:00:00Z`), [day, viewerZone]);
  const slots = useSlots({ fetcher, bookingType, from, to, viewerZone });
  // Only times still ahead, and never the meeting's own current time.
  const open = slots.slots.filter((s) => new Date(s.start_utc).getTime() > now && s.start_utc !== currentStart);
  const byDay = open.length > 0 ? new Map([[day, open]]) : new Map<string, Slot[]>();

  const move = (n: number) => {
    setDay((d) => addDays(d, n));
    setPicked(null);
  };

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await onReschedule(picked, reason.trim());
    } catch (err) {
      setError(describeError ? describeError(err) : err instanceof Error && err.message ? err.message : labels.rescheduleFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={labels.rescheduleTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cx('cal-btn', classNames.button)} onClick={onClose} disabled={busy}>{labels.cancelKeep}</button>
          <button type="button" className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)} onClick={() => void submit()} disabled={!picked || busy}>
            {picked ? labels.rescheduleConfirm(formatZonedTime(picked.start_utc, viewerZone)) : labels.reschedulePick}
          </button>
        </>
      }
    >
      <p className="cal-modal__text"><strong>{title}</strong>. {labels.rescheduleNow(formatZonedDateTime(currentStart, viewerZone))}</p>
      <div className="cal-modal__day">
        <button type="button" className="cal-modal__daynav" aria-label={labels.reschedulePrevDay} onClick={() => move(-1)} disabled={day <= today || busy}>‹</button>
        <p>{formatIn(from, viewerZone, 'EEEE d MMMM')}</p>
        <button type="button" className="cal-modal__daynav" aria-label={labels.rescheduleNextDay} onClick={() => move(1)} disabled={busy}>›</button>
      </div>
      {slots.loading ? (
        <p className="cal-modal__hint" aria-live="polite">{labels.rescheduleLoading}</p>
      ) : (
        <SlotPicker
          byDay={byDay}
          viewerZone={viewerZone}
          hostZone={hostZone}
          showDayHeading={false}
          selected={picked?.start_utc ?? null}
          disabled={busy}
          emptyLabel={labels.rescheduleNoTimes}
          onPick={setPicked}
        />
      )}
      {slots.error ? <p className="cal-modal__error" role="alert">{describeError ? describeError(slots.error) : labels.rescheduleFailed}</p> : null}
      <label className="cal-modal__field">
        {labels.rescheduleReason}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} disabled={busy} />
      </label>
      {error && <p className="cal-modal__error" role="alert">{error}</p>}
    </ModalShell>
  );
}
