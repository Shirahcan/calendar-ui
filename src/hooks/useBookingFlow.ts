import { useCallback, useEffect, useState } from 'react';
import type { Booking, Slot } from '../types';

export interface BookingFlowActions {
  /** Hold the slot. The product passes the idempotency key through to the service. */
  hold: (slot: Slot, idempotencyKey: string) => Promise<Booking>;
  confirm: (bookingId: string) => Promise<Booking>;
  release?: (bookingId: string) => Promise<unknown>;
}

export type FlowStep =
  | { step: 'pick' }
  | { step: 'holding'; slot: Slot }
  | { step: 'held'; slot: Slot; booking: Booking }
  | { step: 'confirming'; slot: Slot; booking: Booking }
  | { step: 'done'; booking: Booking }
  | { step: 'error'; slot: Slot | null; error: unknown; code: string | null };

export interface BookingFlow {
  state: FlowStep;
  /** Seconds left on the hold, or null when nothing is held. */
  secondsLeft: number | null;
  pick: (slot: Slot) => Promise<void>;
  confirm: () => Promise<void>;
  /** Back to picking; releases a live hold so the slot frees at once. */
  restart: () => void;
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; errors?: { code?: unknown } };
    if (typeof e.code === 'string') return e.code;
    if (e.errors && typeof e.errors.code === 'string') return e.errors.code;
  }

  return null;
}

/**
 * pick -> hold -> confirm, with the hold's countdown. Every transition happens in an
 * event handler; the only effect is the one-second clock while a hold is live.
 */
export function useBookingFlow(actions: BookingFlowActions): BookingFlow {
  const [state, setState] = useState<FlowStep>({ step: 'pick' });
  const [now, setNow] = useState(() => Date.now());

  const expiresAt = state.step === 'held' || state.step === 'confirming' ? state.booking.hold_expires_at : null;

  useEffect(() => {
    if (expiresAt === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const secondsLeft = expiresAt === null ? null : Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));

  const pick = useCallback(async (slot: Slot) => {
    setState({ step: 'holding', slot });
    try {
      // One key per attempt: a double-click is the same attempt, a re-pick is a new one.
      const booking = await actions.hold(slot, crypto.randomUUID());
      setNow(Date.now());
      setState({ step: 'held', slot, booking });
    } catch (error) {
      setState({ step: 'error', slot, error, code: errorCode(error) });
    }
  }, [actions]);

  const confirm = useCallback(async () => {
    if (state.step !== 'held') return;
    const { slot, booking } = state;
    setState({ step: 'confirming', slot, booking });
    try {
      setState({ step: 'done', booking: await actions.confirm(booking.id) });
    } catch (error) {
      setState({ step: 'error', slot, error, code: errorCode(error) });
    }
  }, [actions, state]);

  const restart = useCallback(() => {
    if (state.step === 'held' && actions.release) {
      void actions.release(state.booking.id).catch(() => undefined);
    }
    setState({ step: 'pick' });
  }, [actions, state]);

  return { state, secondsLeft, pick, confirm, restart };
}
