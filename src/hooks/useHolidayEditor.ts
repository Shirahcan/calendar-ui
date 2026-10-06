import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** A holiday as calendar-service reports it (GET /v1/holidays/{region}?include=proposed,rejected). */
export interface HolidayRow {
  region: string;
  date: string;
  name: string;
  source: string;
  observed: boolean;
  status: 'confirmed' | 'proposed' | 'rejected';
  estimated?: boolean;
  sources?: Array<{ title?: string; url?: string; domain?: string }>;
  decided_by?: string | null;
}

/**
 * What the editor needs from the product. Each call goes to the PRODUCT's backend, which calls
 * calendar-service through shirahcan/calendar-client (the package never calls the service).
 */
export interface HolidayEditorAdapter {
  /** Every row for the region and year, review list included. */
  load: (region: string, year: number) => Promise<HolidayRow[]>;
  /** Add, rename, or confirm-with-a-new-name. */
  put: (region: string, date: string, name: string) => Promise<unknown>;
  remove: (region: string, date: string) => Promise<unknown>;
  confirm: (region: string, date: string) => Promise<unknown>;
  reject: (region: string, date: string) => Promise<unknown>;
}

export interface HolidayEditorState {
  region: string;
  year: number;
  rows: HolidayRow[];
  waiting: HolidayRow[];
  holidays: HolidayRow[];
  removed: HolidayRow[];
  loading: boolean;
  error: unknown;
  /** The date a change is running for (its buttons disable), or null. */
  busy: string | null;
  setRegion: (region: string) => void;
  setYear: (year: number) => void;
  reload: () => Promise<void>;
  add: (date: string, name: string) => Promise<boolean>;
  rename: (date: string, name: string) => Promise<boolean>;
  remove: (date: string) => Promise<boolean>;
  putBack: (row: HolidayRow) => Promise<boolean>;
  confirm: (date: string) => Promise<boolean>;
  reject: (date: string) => Promise<boolean>;
}

export interface UseHolidayEditorOptions extends HolidayEditorAdapter {
  initialRegion: string;
  initialYear: number;
}

/**
 * The holiday corrections every product's admin makes in ONE place (calendar-service): add a
 * date the formula cannot compute (an Eid), rename one, remove one (a tombstone the yearly sync
 * never puts back), and confirm or reject a researched date waiting for review. Only confirmed
 * holidays close anybody's calendar.
 */
export function useHolidayEditor({ initialRegion, initialYear, load, put, remove, confirm, reject }: UseHolidayEditorOptions): HolidayEditorState {
  const [region, setRegion] = useState(initialRegion);
  const [year, setYear] = useState(initialYear);
  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const loadRef = useRef(load);
  const asked = useRef(0);

  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const ticket = ++asked.current;
    setLoading(true);
    try {
      const next = await loadRef.current(region, year);
      if (ticket !== asked.current) return; // a later region/year won
      setRows([...next].sort((a, b) => a.date.localeCompare(b.date)));
      setError(null);
    } catch (e) {
      if (ticket === asked.current) setError(e);
    } finally {
      if (ticket === asked.current) setLoading(false);
    }
  }, [region, year]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(async (date: string, action: () => Promise<unknown>) => {
    setBusy(date);
    try {
      await action();
      setError(null);
      await reload();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(null);
    }
  }, [reload]);

  const grouped = useMemo(() => ({
    waiting: rows.filter((r) => r.status === 'proposed'),
    holidays: rows.filter((r) => r.status === 'confirmed' && r.observed),
    removed: rows.filter((r) => (r.status === 'confirmed' && !r.observed) || r.status === 'rejected'),
  }), [rows]);

  return {
    region,
    year,
    rows,
    ...grouped,
    loading,
    error,
    busy,
    setRegion,
    setYear,
    reload,
    add: (date, name) => run(date, () => put(region, date, name.trim())),
    rename: (date, name) => run(date, () => put(region, date, name.trim())),
    remove: (date) => run(date, () => remove(region, date)),
    putBack: (row) => run(row.date, () => put(region, row.date, row.name)),
    confirm: (date) => run(date, () => confirm(region, date)),
    reject: (date) => run(date, () => reject(region, date)),
  };
}
