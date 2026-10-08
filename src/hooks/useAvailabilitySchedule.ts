import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { AvailabilitySpec, HolidayRegion, SchedulingPolicy } from '../types';
import { reduceSpec, specProblems, type EditorAction } from './useAvailabilityEditor';

/** A public holiday the service holds for a region (GET /v1/holidays/{region}). */
export interface HolidayDay {
  date: string;
  name: string;
}

/**
 * What the availability editor needs from the product: its own backend, which talks to
 * calendar-service through shirahcan/calendar-client (the package never calls the service).
 */
/** What one load returns: the person's spec, their product's policy, and the places with holidays. */
export interface AvailabilityLoaded {
  spec: AvailabilitySpec;
  policy: SchedulingPolicy;
  regions: HolidayRegion[];
}

export interface AvailabilityAdapter {
  load: () => Promise<AvailabilityLoaded>;
  /** Saves and returns the spec as the service now holds it. */
  save: (spec: AvailabilitySpec) => Promise<AvailabilitySpec>;
  /** The region's public holidays for a year, so a person can choose which ones to work. */
  holidays?: (region: string, year: number) => Promise<HolidayDay[]>;
}

const EMPTY: AvailabilitySpec = { schema: 1, timezone: { zone: 'UTC' } };

/** Load, edit, and save one person's availability spec. */
export function useAvailabilitySchedule(adapter: AvailabilityAdapter) {
  const [saved, setSaved] = useState<AvailabilitySpec | null>(null);
  const [spec, dispatch] = useReducer(reduceSpec, EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [policy, setPolicy] = useState<SchedulingPolicy | null>(null);
  const [regions, setRegions] = useState<HolidayRegion[]>([]);

  const adopt = useCallback((next: AvailabilitySpec) => {
    setSaved(next);
    dispatch({ type: 'reset', spec: next });
  }, []);

  useEffect(() => {
    let live = true;
    adapter
      .load()
      .then((loaded) => {
        if (!live) return;
        setPolicy(loaded.policy);
        setRegions(loaded.regions);
        adopt(loaded.spec);
      })
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [adapter, adopt]);

  const problems = useMemo(() => specProblems(spec), [spec]);
  const dirty = saved !== null && JSON.stringify(spec) !== JSON.stringify(saved);

  const edit = useCallback((action: EditorAction) => {
    setJustSaved(false);
    dispatch(action);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      adopt(await adapter.save(spec));
      setJustSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }, [adapter, adopt, spec]);

  const discard = useCallback(() => {
    if (saved) dispatch({ type: 'reset', spec: saved });
  }, [saved]);

  return { spec, policy, regions, edit, problems, dirty, loading, saving, error, justSaved, save, discard, ready: saved !== null && policy !== null };
}

export type AvailabilitySchedule = ReturnType<typeof useAvailabilitySchedule>;
