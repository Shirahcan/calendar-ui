import { useState, type ReactNode } from 'react';
import { formatIn, itemsOn, type GridDay } from '../time';
import { cx, useCalendarUi } from '../theme';
import { zoneLabel } from '../zoned';
import type { CalendarItem } from '../types';

export interface MonthViewProps {
  days: GridDay[];
  items: CalendarItem[];
  zone: string;
  /** Items shown per cell before "+N more", which reveals the rest of that day in place. */
  maxPerDay?: number;
  /** The date number was chosen (e.g. to open that day). "+N more" no longer calls this. */
  onSelectDay?: (day: GridDay) => void;
  onItemClick?: (item: CalendarItem) => void;
  /** The inside of one item chip, when a product needs it to look entirely different. */
  renderItem?: (item: CalendarItem) => ReactNode;
  className?: string;
}

export function MonthView({ days, items, zone, maxPerDay = 3, onSelectDay, onItemClick, renderItem, className }: MonthViewProps) {
  const { labels, classNames, timePattern } = useCalendarUi();
  const weekdays = days.slice(0, 7);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));
  // The days whose every item is showing: "+N more" reveals them where the reader is looking.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <div className={cx('cal-month', classNames.month, className)} role="grid" aria-label={formatIn(days[10]?.start ?? new Date(), zone, 'MMMM yyyy')}>
      <div className="cal-month__head" role="row">
        {weekdays.map((d) => <div key={d.key} role="columnheader" className="cal-month__dow">{formatIn(d.start, zone, 'EEE')}</div>)}
      </div>

      {weeks.map((week) => (
        <div key={week[0]?.key} className="cal-month__week" role="row">
          {week.map((d) => {
            const dayItems = itemsOn(items, d).sort((a, b) => a.start.getTime() - b.start.getTime());
            const extra = dayItems.length - maxPerDay;
            const open = extra > 0 && expanded.has(d.key);

            return (
              <div key={d.key} role="gridcell" className={cx('cal-month__cell', !d.inMonth && 'is-outside', d.isToday && 'is-today', open && 'is-expanded')}>
                <button type="button" className="cal-month__date" aria-label={formatIn(d.start, zone, 'EEEE d MMMM yyyy')} onClick={() => onSelectDay?.(d)}>
                  {formatIn(d.start, zone, 'd')}
                </button>
                {(open ? dayItems : dayItems.slice(0, maxPerDay)).map((it) => (
                  <button type="button" key={it.id} className={cx('cal-item', `cal-item--${it.layer}`, 'cal-item--compact', classNames.item)} style={it.color ? { background: it.color } : undefined}
                    aria-label={`${it.title}, ${it.allDay ? labels.allDay : `${formatIn(it.start, zone, timePattern)} ${zoneLabel(it.start, zone)}`}`} onClick={() => onItemClick?.(it)}>
                    {renderItem ? renderItem(it) : (
                      <>
                        {!it.allDay && <span className="cal-item__time">{formatIn(it.start, zone, timePattern)}</span>}
                        <span className="cal-item__title">{it.title}</span>
                      </>
                    )}
                  </button>
                ))}
                {extra > 0 && (
                  <button type="button" className="cal-month__more" aria-expanded={open} onClick={() => toggle(d.key)}>
                    {open ? labels.fewerItems : labels.moreItems(extra)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
