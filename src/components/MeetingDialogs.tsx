import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSlots, type SlotFetcher } from '../hooks/useSlots';
import { cx, useCalendarUi } from '../theme';
import { dayKey, formatIn } from '../time';
import type { Slot } from '../types';
import { formatZonedDateTime, formatZonedTime, wallTimeToInstant } from '../zoned';
import { MeetingPeople, MeetingSummary, type MeetingAction, type MeetingView } from './MeetingPanels';
import { RowMenu } from './RowMenu';
import { SlotPicker } from './SlotPicker';
import { AvailabilityMonth } from './AvailabilityMonth';
import { ModalShell } from './ModalShell';

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
 * the room is open, otherwise the meeting page (every detail, notes, its own Join). While Join is
 * the main action, "View details" is the kebab's first item, so the meeting page is always reachable.
 * Any other action sits behind that one kebab, destructive ones last.
 */
export function MeetingQuickView({ meeting, timezone, now, roomOpen, onJoin, onOpenPage, actions = [], onClose, icons, statusClassName, className }: MeetingQuickViewProps) {
  const { labels, classNames } = useCalendarUi();
  const items = [
    ...(roomOpen ? [{ label: labels.quickViewDetails, onSelect: onOpenPage }] : []),
    ...actions.map((a) => ({ label: a.label, onSelect: a.onSelect, danger: a.danger, disabled: a.disabled || a.busy })),
  ];
  const menu = items.length > 0 ? <RowMenu label={labels.quickViewMore} items={items} /> : null;

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

export interface MeetingQuickViewLoadingProps {
  /** What the calendar already knows (the item's title), so the dialog names the meeting at once. */
  title?: string;
  onClose: () => void;
  className?: string;
}

/**
 * The quick look the moment a meeting is clicked, while the product fetches the whole meeting.
 * Without it the click looked like it did nothing until the fetch landed. Swap it for
 * MeetingQuickView when the meeting arrives; closing it is the product's cue to drop the fetch.
 */
export function MeetingQuickViewLoading({ title, onClose, className }: MeetingQuickViewLoadingProps) {
  const { labels, classNames } = useCalendarUi();

  return (
    <ModalShell
      title={title || labels.quickViewLoading}
      onClose={onClose}
      className={cx('cal-modal--loading', className)}
      footer={
        <button type="button" disabled className={cx('cal-btn', 'cal-btn--primary', 'cal-modal__primary', classNames.button, classNames.buttonPrimary)}>
          {labels.quickViewLoading}
        </button>
      }
    >
      <div className="cal-quick-skel" role="status" aria-busy="true" aria-live="polite">
        <span className="cal-sr-only">{labels.quickViewLoading}</span>
        <span className="cal-quick-skel__line" style={{ width: '60%' }} />
        <span className="cal-quick-skel__line" style={{ width: '45%' }} />
        <span className="cal-quick-skel__line" style={{ width: '70%' }} />
        <span className="cal-quick-skel__line" style={{ width: '35%' }} />
      </div>
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
  /**
   * Too late to cancel but still in time to move it (calendar-service refuses a booker's late
   * cancel with `alternative: reschedule`): does this refusal offer that? When it does and
   * `onRescheduleInstead` is given, the dialog offers "Reschedule instead" beside the reason.
   */
  offersReschedule?: (error: unknown) => boolean;
  /** Open the product's reschedule flow for this meeting (the dialog closes itself first). */
  onRescheduleInstead?: () => void;
}

/**
 * Cancel a meeting with a reason the other side is told. Refused for being too late, it offers
 * moving the meeting instead whenever the service says that is still possible.
 */
export function CancelMeetingDialog({ title, otherParty, onCancel, onClose, describeError, offersReschedule, onRescheduleInstead }: CancelMeetingDialogProps) {
  const { labels, classNames } = useCalendarUi();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canMove, setCanMove] = useState(false);
  const ok = reason.trim().length >= 5;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setCanMove(false);
    try {
      await onCancel(reason.trim());
    } catch (err) {
      setError(describeError ? describeError(err) : err instanceof Error && err.message ? err.message : labels.cancelFailed);
      setCanMove(Boolean(onRescheduleInstead && offersReschedule?.(err)));
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
      {error && <p className="cal-modal__error" role="alert">{error}{canMove ? ` ${labels.cancelLateOffer}` : ''}</p>}
      {canMove && onRescheduleInstead && (
        <button
          type="button"
          className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)}
          onClick={() => {
            onClose();
            onRescheduleInstead();
          }}
        >
          {labels.cancelRescheduleInstead}
        </button>
      )}
    </ModalShell>
  );
}

export interface LinkMeetingOption {
  id: string;
  label: string;
  /** A second line: a reference number, a status. */
  detail?: string;
  /** The one this meeting most likely belongs to (shown first, chosen to start). */
  suggested?: boolean;
}

export interface LinkMeetingDialogProps {
  title: string;
  /** What the product links a meeting to, in its words ("case"). */
  noun: string;
  options: LinkMeetingOption[];
  /** The one it is linked to now, if any. */
  currentId?: string | null;
  /** The product's call. A rejection keeps the dialog open and shows why. */
  onLink: (id: string) => Promise<void>;
  onClose: () => void;
  describeError?: (error: unknown) => string;
}

/**
 * Link a meeting to the record it serves (a case, an application): so what the call decides lands
 * on that record. The product supplies the choices and does the linking.
 */
export function LinkMeetingDialog({ title, noun, options, currentId, onLink, onClose, describeError }: LinkMeetingDialogProps) {
  const { labels, classNames } = useCalendarUi();
  const ordered = [...options].sort((a, b) => Number(Boolean(b.suggested)) - Number(Boolean(a.suggested)));
  const [picked, setPicked] = useState<string | null>(currentId ?? ordered.find((o) => o.suggested)?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (picked === null) return;
    setBusy(true);
    setError(null);
    try {
      await onLink(picked);
    } catch (err) {
      setError(describeError ? describeError(err) : err instanceof Error && err.message ? err.message : labels.linkMeetingFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={labels.linkTitle(noun)}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cx('cal-btn', classNames.button)} onClick={onClose} disabled={busy}>{labels.linkKeep}</button>
          <button type="button" className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)} onClick={() => void submit()}
            disabled={picked === null || picked === currentId || busy}>
            {busy ? labels.linkBusy : labels.linkConfirm(noun)}
          </button>
        </>
      }
    >
      <p className="cal-modal__text"><strong>{title}</strong>. {labels.linkWhy(noun)}</p>
      {ordered.length === 0 ? (
        <p className="cal-modal__text">{labels.linkNone(noun)}</p>
      ) : (
        <div className="cal-link-list" role="radiogroup" aria-label={labels.linkTitle(noun)}>
          {ordered.map((o) => (
            <label key={o.id} className={cx('cal-link-option', picked === o.id && 'is-picked')}>
              <input type="radio" name="cal-link" value={o.id} checked={picked === o.id} onChange={() => setPicked(o.id)} disabled={busy} />
              <span className="cal-link-option__text">
                <span className="cal-link-option__label">{o.label}</span>
                {(o.detail || o.suggested || o.id === currentId) && (
                  <span className="cal-link-option__detail">
                    {[o.detail, o.id === currentId ? labels.linkCurrent : null, o.suggested ? labels.linkSuggested : null].filter(Boolean).join(', ')}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
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
  /**
   * The open-time counts for a month (`yyyy-MM`), keyed `yyyy-MM-dd` on the viewer's clock, and the
   * last day that may be picked. Given, the dialog moves a meeting the way one is booked: a month
   * of days shaded by how many times are open (AvailabilityMonth), then that day's times. Without
   * it, the dialog steps a day at a time (kept for products that have no month counts yet).
   */
  monthCounts?: (month: string) => Promise<{ counts: Record<string, number>; lastBookable?: string | null }>;
  /** `rebook`: the meeting did not happen and a NEW one is booked (RebookDialog); default `move`. */
  intent?: 'move' | 'rebook';
}

/** The month of days the reschedule dialog opens on, read through the product's `monthCounts`. */
type MonthRead = { month: string; counts: Record<string, number>; lastBookable: string | null };

function RescheduleMonth({ monthCounts, cache, today, initial, selected, onSelect, describeError }: {
  monthCounts: NonNullable<RescheduleDialogProps['monthCounts']>;
  /** Months already read in this dialog: going back to the days is instant, not a second fetch. */
  cache: Map<string, MonthRead>;
  today: string;
  initial: string;
  selected: string | null;
  onSelect: (day: string) => void;
  describeError?: (error: unknown) => string;
}) {
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [read, setRead] = useState<MonthRead | null>(() => cache.get(initial.slice(0, 7)) ?? null);
  const [failed, setFailed] = useState<{ month: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const held = cache.get(month);
    if (held) {
      setRead(held);
      return () => { live = false; };
    }
    monthCounts(month)
      .then((r) => {
        const got = { month, counts: r.counts, lastBookable: r.lastBookable ?? null };
        cache.set(month, got);
        if (live) setRead(got);
      })
      .catch((err: unknown) => {
        if (live) setFailed({ month, message: describeError ? describeError(err) : err instanceof Error ? err.message : String(err) });
      });
    return () => { live = false; };
  }, [month, monthCounts, describeError, attempt, cache]);

  const shown = read?.month === month ? read : null;
  const error = failed?.month === month && !shown ? failed.message : null;

  return (
    <AvailabilityMonth
      month={month}
      counts={shown?.counts ?? {}}
      today={today}
      lastBookable={shown?.lastBookable ?? read?.lastBookable ?? null}
      selected={selected}
      onSelect={onSelect}
      onMonthChange={setMonth}
      loading={!shown && !error}
      error={error}
      onRetry={() => { setFailed(null); setAttempt((n) => n + 1); }}
    />
  );
}

/**
 * Move a meeting to another OPEN time: a day at a time on the viewer's clock, picked from the
 * host's real availability, sent as a UTC instant. Never a free date and time box: that sent a
 * wall time with no zone and offered times nobody was free.
 */
export function RescheduleDialog({ title, currentStart, viewerZone, hostZone, fetcher, bookingType, now, onReschedule, onClose, describeError, monthCounts, intent = 'move' }: RescheduleDialogProps) {
  const { labels, classNames } = useCalendarUi();
  const today = dayKey(now, viewerZone);
  const [day, setDay] = useState(() => {
    const current = dayKey(currentStart, viewerZone);
    return current > today ? current : today;
  });
  // With month counts the dialog opens on the month of days, as booking does.
  const [step, setStep] = useState<'days' | 'times'>(monthCounts ? 'days' : 'times');
  const [months] = useState(() => new Map<string, MonthRead>());
  const [picked, setPicked] = useState<Slot | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => new Date(wallTimeToInstant(`${day}T00:00`, viewerZone) ?? `${day}T00:00:00Z`), [day, viewerZone]);
  const to = useMemo(() => new Date(wallTimeToInstant(`${addDays(day, 1)}T00:00`, viewerZone) ?? `${addDays(day, 1)}T00:00:00Z`), [day, viewerZone]);
  const slots = useSlots({ fetcher, bookingType, from, to, viewerZone });
  // Only times still ahead, never the meeting's own current time, and only times ON the chosen
  // day: the times are listed under that day's name, so a fetcher that hands back another day's
  // times (a different zone's day, the next open day) would book a day the person never picked.
  const open = slots.slots.filter((s) => new Date(s.start_utc).getTime() > now && s.start_utc !== currentStart && dayKey(s.start_utc, viewerZone) === day);
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
      title={intent === 'rebook' ? labels.rebookTitle : labels.rescheduleTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cx('cal-btn', classNames.button)} onClick={onClose} disabled={busy}>{labels.cancelKeep}</button>
          <button type="button" className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)} onClick={() => void submit()} disabled={!picked || busy}>
            {picked ? (intent === 'rebook' ? labels.rebookConfirm : labels.rescheduleConfirm)(formatZonedTime(picked.start_utc, viewerZone)) : labels.reschedulePick}
          </button>
        </>
      }
    >
      <p className="cal-modal__text"><strong>{title}</strong>. {(intent === 'rebook' ? labels.rebookMissed : labels.rescheduleNow)(formatZonedDateTime(currentStart, viewerZone))}</p>
      {monthCounts && step === 'days' ? (
        <>
          <p className="cal-modal__hint">{labels.rescheduleChooseDay}</p>
          <RescheduleMonth
            monthCounts={monthCounts}
            cache={months}
            today={today}
            initial={day}
            selected={null}
            onSelect={(d) => { setDay(d); setPicked(null); setStep('times'); }}
            describeError={describeError}
          />
        </>
      ) : monthCounts ? (
        <div className="cal-modal__day">
          <button type="button" className="cal-modal__daynav cal-modal__daynav--text" onClick={() => { setStep('days'); setPicked(null); }} disabled={busy}>‹ {labels.rescheduleOtherDay}</button>
          <p>{formatIn(from, viewerZone, 'EEEE d MMMM')}</p>
        </div>
      ) : (
        <div className="cal-modal__day">
          <button type="button" className="cal-modal__daynav" aria-label={labels.reschedulePrevDay} onClick={() => move(-1)} disabled={day <= today || busy}>‹</button>
          <p>{formatIn(from, viewerZone, 'EEEE d MMMM')}</p>
          <button type="button" className="cal-modal__daynav" aria-label={labels.rescheduleNextDay} onClick={() => move(1)} disabled={busy}>›</button>
        </div>
      )}
      {monthCounts && step === 'days' ? null : slots.loading ? (
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

export type RebookDialogProps = Omit<RescheduleDialogProps, 'intent' | 'onReschedule'> & {
  /** The product books the new meeting at this slot. A rejection keeps the dialog open. */
  onRebook: (slot: Slot, note: string) => Promise<void>;
};

/**
 * Book a call that did not happen (a no-show) again: the same day-then-times picker as moving a
 * meeting, said as a new booking. The missed time is shown at the top.
 */
export function RebookDialog({ onRebook, ...rest }: RebookDialogProps) {
  return <RescheduleDialog {...rest} intent="rebook" onReschedule={onRebook} />;
}
