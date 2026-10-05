import type { ReactNode } from 'react';
import { formatIn } from '../time';
import { cx, useCalendarUi } from '../theme';
import { zoneLabel } from '../zoned';
import type { BookingFlow as Flow } from '../hooks/useBookingFlow';
import type { Slot } from '../types';
import { SlotPicker } from './SlotPicker';

export interface BookingFlowProps {
  flow: Flow;
  byDay: Map<string, Slot[]>;
  viewerZone: string;
  hostZone?: string;
  loading?: boolean;
  /** The product's details step (intake questions, payment) shown while the slot is held. */
  details?: ReactNode;
  /** The real verb, e.g. "Book consultation" or "Pay and book". Defaults to `labels.confirm`. */
  confirmLabel?: string;
  done?: ReactNode;
  /** Product-specific wording per service error code (slot_unavailable, hold_expired, ...). */
  errorText?: (code: string | null, error: unknown) => string;
  staleExternal?: boolean;
  className?: string;
}

/** slot -> details (while the hold counts down) -> review with the real verb -> done. */
export function BookingFlow({ flow, byDay, viewerZone, hostZone, loading, details, confirmLabel, done, errorText, staleExternal, className }: BookingFlowProps) {
  const { labels, classNames } = useCalendarUi();
  const { state } = flow;
  const root = (modifier: string) => cx('cal-flow', modifier, classNames.flow, className);

  if (state.step === 'done') {
    return (
      <div className={root('cal-flow--done')} role="status">
        {done ?? labels.bookedFor(`${formatIn(state.booking.start_utc, viewerZone, 'EEEE d MMMM, h:mm a')} ${zoneLabel(state.booking.start_utc, viewerZone)}`)}
      </div>
    );
  }

  if (state.step === 'held' || state.step === 'confirming') {
    const mins = Math.floor((flow.secondsLeft ?? 0) / 60);
    const secs = String((flow.secondsLeft ?? 0) % 60).padStart(2, '0');

    return (
      <div className={root('cal-flow--held')}>
        <p className="cal-flow__summary">
          {formatIn(state.slot.start_utc, viewerZone, 'EEEE d MMMM, h:mm a')} to {formatIn(state.slot.end_utc, viewerZone, 'h:mm a')} {zoneLabel(state.slot.end_utc, viewerZone)}
        </p>
        <p className="cal-flow__timer" aria-live="polite">{labels.holdingFor(mins, secs)}</p>
        {details}
        <div className="cal-flow__actions">
          <button type="button" className={cx('cal-btn', 'cal-btn--ghost', classNames.button)} onClick={flow.restart} disabled={state.step === 'confirming'}>{labels.pickAnother}</button>
          <button type="button" className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)} onClick={() => void flow.confirm()} disabled={state.step === 'confirming' || flow.secondsLeft === 0}>
            {state.step === 'confirming' ? labels.confirming : (confirmLabel ?? labels.confirm)}
          </button>
        </div>
      </div>
    );
  }

  const known: Record<string, string> = { slot_unavailable: labels.slotTaken, hold_expired: labels.holdExpired };
  const error = state.step === 'error'
    ? (errorText?.(state.code, state.error) ?? (state.code ? known[state.code] : undefined) ?? labels.bookingFailed)
    : null;

  return (
    <div className={root('cal-flow--pick')}>
      {error && <p className="cal-flow__error" role="alert">{error}</p>}
      {staleExternal && <p className="cal-flow__note">{labels.staleCalendars}</p>}
      {loading ? <p className="cal-slots__loading" aria-busy="true">{labels.findingTimes}</p> : (
        <SlotPicker byDay={byDay} viewerZone={viewerZone} hostZone={hostZone} disabled={state.step === 'holding'}
          selected={state.step === 'holding' ? state.slot.start_utc : null} onPick={(s) => void flow.pick(s)} />
      )}
    </div>
  );
}
