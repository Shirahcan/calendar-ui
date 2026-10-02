import type { ReactNode } from 'react';
import { formatIn } from '../time';
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
  /** The real verb, e.g. "Book consultation" or "Pay and book". */
  confirmLabel?: string;
  done?: ReactNode;
  /** Product-specific wording per service error code (slot_unavailable, hold_expired, ...). */
  errorText?: (code: string | null, error: unknown) => string;
  staleExternal?: boolean;
}

const DEFAULT_ERRORS: Record<string, string> = {
  slot_unavailable: 'That time was just taken. Please pick another.',
  hold_expired: 'We held that time for you, but the hold ran out. Please pick a time again.',
};

/** slot -> details (while the hold counts down) -> review with the real verb -> done. */
export function BookingFlow({ flow, byDay, viewerZone, hostZone, loading, details, confirmLabel = 'Confirm booking', done, errorText, staleExternal }: BookingFlowProps) {
  const { state } = flow;

  if (state.step === 'done') {
    return <div className="cal-flow cal-flow--done" role="status">{done ?? `Booked for ${formatIn(state.booking.start_utc, viewerZone, 'EEEE d MMMM, h:mm a')}.`}</div>;
  }

  if (state.step === 'held' || state.step === 'confirming') {
    const mins = Math.floor((flow.secondsLeft ?? 0) / 60);
    const secs = String((flow.secondsLeft ?? 0) % 60).padStart(2, '0');

    return (
      <div className="cal-flow cal-flow--held">
        <p className="cal-flow__summary">
          {formatIn(state.slot.start_utc, viewerZone, 'EEEE d MMMM, h:mm a')} to {formatIn(state.slot.end_utc, viewerZone, 'h:mm a')}
        </p>
        <p className="cal-flow__timer" aria-live="polite">We are holding this time for {mins}:{secs}.</p>
        {details}
        <div className="cal-flow__actions">
          <button type="button" className="cal-btn cal-btn--ghost" onClick={flow.restart} disabled={state.step === 'confirming'}>Pick another time</button>
          <button type="button" className="cal-btn cal-btn--primary" onClick={() => void flow.confirm()} disabled={state.step === 'confirming' || flow.secondsLeft === 0}>
            {state.step === 'confirming' ? 'Booking…' : confirmLabel}
          </button>
        </div>
      </div>
    );
  }

  const error = state.step === 'error'
    ? (errorText?.(state.code, state.error) ?? (state.code ? DEFAULT_ERRORS[state.code] : undefined) ?? 'Something went wrong while booking. Please try again.')
    : null;

  return (
    <div className="cal-flow cal-flow--pick">
      {error && <p className="cal-flow__error" role="alert">{error}</p>}
      {staleExternal && <p className="cal-flow__note">Some calendars have not synced recently, so a time shown here may already be taken. We check again when you book.</p>}
      {loading ? <p className="cal-slots__loading" aria-busy="true">Finding open times…</p> : (
        <SlotPicker byDay={byDay} viewerZone={viewerZone} hostZone={hostZone} disabled={state.step === 'holding'}
          selected={state.step === 'holding' ? state.slot.start_utc : null} onPick={(s) => void flow.pick(s)} />
      )}
    </div>
  );
}
