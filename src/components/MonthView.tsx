import { formatIn, itemsOn, type GridDay } from '../time';
import { zoneLabel } from '../zoned';
import type { CalendarItem } from '../types';

export interface MonthViewProps {
  days: GridDay[];
  items: CalendarItem[];
  zone: string;
  /** Items shown per cell before "+N more". */
  maxPerDay?: number;
  onSelectDay?: (day: GridDay) => void;
  onItemClick?: (item: CalendarItem) => void;
  className?: string;
}

export function MonthView({ days, items, zone, maxPerDay = 3, onSelectDay, onItemClick, className }: MonthViewProps) {
  const weekdays = days.slice(0, 7);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));

  return (
    <div className={`cal-month ${className ?? ''}`} role="grid" aria-label={formatIn(days[10]?.start ?? new Date(), zone, 'MMMM yyyy')}>
      <div className="cal-month__head" role="row">
        {weekdays.map((d) => <div key={d.key} role="columnheader" className="cal-month__dow">{formatIn(d.start, zone, 'EEE')}</div>)}
      </div>

      {weeks.map((week) => (
        <div key={week[0]?.key} className="cal-month__week" role="row">
          {week.map((d) => {
            const dayItems = itemsOn(items, d).sort((a, b) => a.start.getTime() - b.start.getTime());
            const extra = dayItems.length - maxPerDay;

            return (
              <div key={d.key} role="gridcell" className={`cal-month__cell${d.inMonth ? '' : ' is-outside'}${d.isToday ? ' is-today' : ''}`}>
                <button type="button" className="cal-month__date" aria-label={formatIn(d.start, zone, 'EEEE d MMMM yyyy')} onClick={() => onSelectDay?.(d)}>
                  {formatIn(d.start, zone, 'd')}
                </button>
                {dayItems.slice(0, maxPerDay).map((it) => (
                  <button type="button" key={it.id} className={`cal-item cal-item--${it.layer} cal-item--compact`} style={it.color ? { background: it.color } : undefined}
                    aria-label={`${it.title}, ${it.allDay ? 'all day' : `${formatIn(it.start, zone, 'HH:mm')} ${zoneLabel(it.start, zone)}`}`} onClick={() => onItemClick?.(it)}>
                    {!it.allDay && <span className="cal-item__time">{formatIn(it.start, zone, 'HH:mm')}</span>}
                    <span className="cal-item__title">{it.title}</span>
                  </button>
                ))}
                {extra > 0 && (
                  <button type="button" className="cal-month__more" onClick={() => onSelectDay?.(d)}>+{extra} more</button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
