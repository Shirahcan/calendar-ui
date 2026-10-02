import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { slotsByDay } from '../time';
import type { Slot } from '../types';

/** The product's own call to ITS backend, which calls the service. The package never does. */
export type SlotFetcher = (bookingType: string, fromIso: string, toIso: string) => Promise<{ slots: Slot[]; stale_external?: boolean }>;

interface Loaded {
  key: string;
  slots: Slot[];
  staleExternal: boolean;
  error: unknown;
}

export interface SlotsState {
  slots: Slot[];
  byDay: Map<string, Slot[]>;
  loading: boolean;
  error: unknown;
  /** A host's external calendar could not be read recently: offered times may be stale. */
  staleExternal: boolean;
  reload: () => void;
}

/**
 * Slots for a booking type over a range, grouped by the VIEWER's day.
 *
 * The result is keyed by the request it answers, so "loading" is DERIVED (the stored key
 * differs from the current one) rather than set synchronously inside the effect. A late
 * answer for an old range is simply ignored.
 */
export function useSlots(options: { fetcher: SlotFetcher; bookingType: string; from: Date; to: Date; viewerZone: string }): SlotsState {
  const { fetcher, bookingType, from, to, viewerZone } = options;
  const [nonce, setNonce] = useState(0);
  const key = `${bookingType}|${from.toISOString()}|${to.toISOString()}|${nonce}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // The latest fetcher, kept OUTSIDE the effect's dependencies: products pass a new closure
  // every render, and that must not refetch. Written in an effect, never during render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let current = true;
    // Everything the request needs travels in the key, so the key is the only dependency.
    const [type = '', fromIso = '', toIso = ''] = key.split('|');

    fetcherRef.current(type, fromIso, toIso).then(
      (res) => current && setLoaded({ key, slots: res.slots, staleExternal: Boolean(res.stale_external), error: null }),
      (error: unknown) => current && setLoaded({ key, slots: [], staleExternal: false, error }),
    );

    return () => {
      current = false;
    };
  }, [key]);

  const fresh = loaded !== null && loaded.key === key;
  const slots = useMemo(() => (fresh ? loaded.slots : []), [fresh, loaded]);
  const byDay = useMemo(() => slotsByDay(slots, viewerZone), [slots, viewerZone]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    slots,
    byDay,
    loading: !fresh,
    error: fresh ? loaded.error : null,
    staleExternal: fresh ? loaded.staleExternal : false,
    reload,
  };
}
