import { useCallback, useMemo, useState } from 'react';
import { gridDays, shiftAnchor, type GridDay, type WeekStart } from '../time';
import type { View } from '../types';

export interface CalendarRange {
  view: View;
  anchor: Date;
  days: GridDay[];
  /** The span to fetch for: first grid day's start to the last day's end. */
  from: Date;
  to: Date;
  setView: (view: View) => void;
  setAnchor: (date: Date) => void;
  next: () => void;
  prev: () => void;
  today: () => void;
}

/** Month / week / day navigation in an explicit zone. Holds only the view and the anchor. */
export function useCalendarRange(options: { zone: string; initialView?: View; initialAnchor?: Date; weekStartsOn?: WeekStart }): CalendarRange {
  const { zone, weekStartsOn = 1 } = options;
  const [view, setView] = useState<View>(options.initialView ?? 'week');
  const [anchor, setAnchor] = useState<Date>(() => options.initialAnchor ?? new Date());

  const days = useMemo(() => gridDays(view, anchor, zone, weekStartsOn), [view, anchor, zone, weekStartsOn]);
  const next = useCallback(() => setAnchor((a) => shiftAnchor(view, a, zone, 1)), [view, zone]);
  const prev = useCallback(() => setAnchor((a) => shiftAnchor(view, a, zone, -1)), [view, zone]);
  const today = useCallback(() => setAnchor(new Date()), []);

  const first = days[0];
  const last = days[days.length - 1];

  return {
    view,
    anchor,
    days,
    from: first ? first.start : anchor,
    to: last ? last.end : anchor,
    setView,
    setAnchor,
    next,
    prev,
    today,
  };
}
