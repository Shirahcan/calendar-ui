import { useCallback, useState, type PointerEvent } from 'react';

export interface DragSelection {
  dayKey: string;
  /** Minutes from local midnight, snapped to the step. */
  startMinute: number;
  endMinute: number;
}

/**
 * Drag down a day column to select a window (for adding availability on a week grid).
 * The column element must span `fromMinute`..`toMinute` of the day top to bottom.
 */
export function useDragSelect(options: { stepMinutes?: number; fromMinute?: number; toMinute?: number; onSelect: (s: DragSelection) => void }) {
  const { stepMinutes = 15, fromMinute = 0, toMinute = 1440, onSelect } = options;
  const [drag, setDrag] = useState<{ dayKey: string; anchor: number; current: number } | null>(null);

  const minuteAt = useCallback((e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = rect.height > 0 ? Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) : 0;
    const raw = fromMinute + ratio * (toMinute - fromMinute);

    return Math.round(raw / stepMinutes) * stepMinutes;
  }, [fromMinute, toMinute, stepMinutes]);

  const columnProps = useCallback((dayKey: string) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const m = minuteAt(e);
      setDrag({ dayKey, anchor: m, current: m });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      setDrag((d) => (d && d.dayKey === dayKey ? { ...d, current: minuteAt(e) } : d));
    },
    onPointerUp: () => {
      setDrag((d) => {
        if (d && d.dayKey === dayKey) {
          const start = Math.min(d.anchor, d.current);
          const end = Math.max(d.anchor, d.current);
          if (end - start >= stepMinutes) {
            onSelect({ dayKey, startMinute: start, endMinute: end });
          }
        }

        return null;
      });
    },
  }), [minuteAt, onSelect, stepMinutes]);

  const preview: DragSelection | null = drag
    ? { dayKey: drag.dayKey, startMinute: Math.min(drag.anchor, drag.current), endMinute: Math.max(drag.anchor, drag.current) }
    : null;

  return { columnProps, preview };
}
