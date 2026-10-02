import { useCallback, useMemo, useReducer } from 'react';
import type { AvailabilitySpec, DayName, WeeklyRule } from '../types';

type Window = [string, string];

export type EditorAction =
  | { type: 'reset'; spec: AvailabilitySpec }
  | { type: 'setZone'; zone: string; followHostProfile?: boolean }
  | { type: 'addWeekly'; rule: WeeklyRule }
  | { type: 'updateWeekly'; index: number; rule: WeeklyRule }
  | { type: 'removeWeekly'; index: number }
  | { type: 'addPeriod'; from: string; to: string; weekly: WeeklyRule[] }
  | { type: 'removePeriod'; index: number }
  | { type: 'setDate'; date: string; windows: Window[] }
  | { type: 'removeDate'; date: string }
  | { type: 'setOverride'; date: string; windows: Window[] }
  | { type: 'removeOverride'; date: string }
  | { type: 'addBlock'; block: { from: string; to: string } | { start: string; end: string } }
  | { type: 'removeBlock'; index: number }
  | { type: 'setHolidays'; region: string | null };

const DAYS: DayName[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

function toMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');

  return Number(h) * 60 + Number(m);
}

function upsertDated(rows: { date: string; windows: Window[] }[] | undefined, date: string, windows: Window[]) {
  return [...(rows ?? []).filter((r) => r.date !== date), { date, windows }].sort((a, b) => a.date.localeCompare(b.date));
}

export function reduceSpec(spec: AvailabilitySpec, action: EditorAction): AvailabilitySpec {
  switch (action.type) {
    case 'reset':
      return action.spec;
    case 'setZone':
      return { ...spec, timezone: { zone: action.zone, follow_host_profile: action.followHostProfile ?? spec.timezone.follow_host_profile ?? false } };
    case 'addWeekly':
      return { ...spec, weekly: [...(spec.weekly ?? []), action.rule] };
    case 'updateWeekly':
      return { ...spec, weekly: (spec.weekly ?? []).map((r, i) => (i === action.index ? action.rule : r)) };
    case 'removeWeekly':
      return { ...spec, weekly: (spec.weekly ?? []).filter((_, i) => i !== action.index) };
    case 'addPeriod':
      return { ...spec, periods: [...(spec.periods ?? []), { from: action.from, to: action.to, weekly: action.weekly }] };
    case 'removePeriod':
      return { ...spec, periods: (spec.periods ?? []).filter((_, i) => i !== action.index) };
    case 'setDate':
      return { ...spec, dates: upsertDated(spec.dates, action.date, action.windows) };
    case 'removeDate':
      return { ...spec, dates: (spec.dates ?? []).filter((r) => r.date !== action.date) };
    case 'setOverride':
      return { ...spec, overrides: upsertDated(spec.overrides, action.date, action.windows) };
    case 'removeOverride':
      return { ...spec, overrides: (spec.overrides ?? []).filter((r) => r.date !== action.date) };
    case 'addBlock':
      return { ...spec, blocks: [...(spec.blocks ?? []), action.block] };
    case 'removeBlock':
      return { ...spec, blocks: (spec.blocks ?? []).filter((_, i) => i !== action.index) };
    case 'setHolidays': {
      const { holidays: _drop, ...rest } = spec;

      return action.region ? { ...rest, holidays: { region: action.region, observe: true } } : rest;
    }
  }
}

/**
 * Client-side checks that mirror the service's SpecValidator closely enough to catch
 * typos before a round trip. The SERVICE stays the authority: it re-validates and its
 * 422 lists every problem.
 */
export function specProblems(spec: AvailabilitySpec): string[] {
  const out: string[] = [];
  const checkRule = (r: WeeklyRule, path: string) => {
    if (r.days.length === 0 || r.days.some((d) => !DAYS.includes(d))) out.push(`${path}: pick at least one day.`);
    if (!HHMM.test(r.start) || !HHMM.test(r.end) || r.start === r.end) out.push(`${path}: start and end must be different HH:MM times.`);
  };

  (spec.weekly ?? []).forEach((r, i) => checkRule(r, `Weekly hours ${i + 1}`));
  (spec.periods ?? []).forEach((p, i) => {
    if (p.to < p.from) out.push(`Period ${i + 1}: the end date is before the start date.`);
    p.weekly.forEach((r, j) => checkRule(r, `Period ${i + 1}, hours ${j + 1}`));
  });
  for (const key of ['dates', 'overrides'] as const) {
    for (const row of spec[key] ?? []) {
      // Minutes, with an end at or before its start rolled past midnight (+1440), exactly
      // as the service's SpecValidator does.
      const ranges = row.windows
        .filter(([s, e]) => HHMM.test(s) && HHMM.test(e) && s !== e)
        .map(([s, e]) => {
          const a = toMinutes(s);
          const b = toMinutes(e);

          return [a, b <= a ? b + 1440 : b] as const;
        })
        .sort((x, y) => x[0] - y[0]);
      if (ranges.length !== row.windows.length) out.push(`${row.date}: every window needs different HH:MM times.`);
      for (let i = 1; i < ranges.length; i++) {
        if (ranges[i]![0] < ranges[i - 1]![1]) out.push(`${row.date}: two windows overlap.`);
      }
    }
  }

  return out;
}

/** Edit a schema-1 spec in memory; the product saves it through its backend. */
export function useAvailabilityEditor(initial: AvailabilitySpec) {
  const [spec, dispatch] = useReducer(reduceSpec, initial);
  const problems = useMemo(() => specProblems(spec), [spec]);
  const isDirty = useMemo(() => JSON.stringify(spec) !== JSON.stringify(initial), [spec, initial]);
  const reset = useCallback((next: AvailabilitySpec) => dispatch({ type: 'reset', spec: next }), []);

  return { spec, dispatch, problems, isDirty, reset };
}
