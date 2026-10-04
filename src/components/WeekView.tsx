import type { CSSProperties, ReactNode } from 'react';
import { formatIn, itemsOn, minutesIntoDay, type GridDay } from '../time';
import { zoneLabel } from '../zoned';
import type { CalendarItem } from '../types';
import type { DragSelection } from '../hooks/useDragSelect';

export interface WeekViewProps {
  days: GridDay[];
  items: CalendarItem[];
  /** The zone the grid is drawn in (normally the viewer's). */
  zone: string;
  startHour?: number;
  endHour?: number;
  onItemClick?: (item: CalendarItem) => void;
  renderItem?: (item: CalendarItem) => ReactNode;
  /** From useDragSelect, to let a host draw availability. */
  drag?: { columnProps: (dayKey: string) => object; preview: DragSelection | null };
  className?: string;
}

const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

/** Week (or, with one day, day) grid. Items are placed by their minutes in `zone`. */
export function WeekView({ days, items, zone, startHour = 7, endHour = 20, onItemClick, renderItem, drag, className }: WeekViewProps) {
  const span = (endHour - startHour) * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className={`cal-week ${className ?? ''}`} role="grid" aria-label={`Week of ${days[0] ? formatIn(days[0].start, zone, 'd MMMM yyyy') : ''}`}
      style={{ '--cal-days': days.length } as CSSProperties}>
      <div className="cal-week__head" role="row">
        {/* The zone every time below is in (estate rule: a time always names its zone). */}
        <div className="cal-week__gutter cal-week__zone" title={zone}>{zoneLabel(days[0]?.start ?? Date.now(), zone)}</div>
        {days.map((d) => (
          <div key={d.key} role="columnheader" className={`cal-week__dayhead${d.isToday ? ' is-today' : ''}`}>
            <span className="cal-week__dow">{formatIn(d.start, zone, 'EEE')}</span>
            <span className="cal-week__dom">{formatIn(d.start, zone, 'd')}</span>
          </div>
        ))}
      </div>

      <div className="cal-week__allday" role="row">
        <div className="cal-week__gutter" aria-hidden="true" />
        {days.map((d) => (
          <div key={d.key} role="gridcell" className="cal-week__alldaycell">
            {itemsOn(items, d).filter((it) => it.allDay).map((it) => (
              <button type="button" key={it.id} className={`cal-item cal-item--${it.layer}`} style={it.color ? { background: it.color } : undefined} onClick={() => onItemClick?.(it)}>
                {renderItem ? renderItem(it) : it.title}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="cal-week__body" role="row">
        <div className="cal-week__gutter">
          {hours.map((h) => (
            <div key={h} className="cal-week__hour" aria-hidden="true">{String(h).padStart(2, '0')}:00</div>
          ))}
        </div>

        {days.map((d) => {
          const preview = drag?.preview && drag.preview.dayKey === d.key ? drag.preview : null;

          return (
            <div key={d.key} role="gridcell" aria-label={formatIn(d.start, zone, 'EEEE d MMMM yyyy')} className="cal-week__col" {...(drag ? drag.columnProps(d.key) : {})}>
              {hours.map((h) => <div key={h} className="cal-week__line" aria-hidden="true" />)}

              {itemsOn(items, d).filter((it) => !it.allDay).map((it) => {
                const start = it.start < d.start ? 0 : minutesIntoDay(it.start, zone);
                const end = it.end >= d.end ? 1440 : minutesIntoDay(it.end, zone);
                const label = `${it.title}, ${formatIn(it.start, zone, 'EEEE d MMMM, HH:mm')} to ${formatIn(it.end, zone, 'HH:mm')} ${zoneLabel(it.start, zone)}`;

                return (
                  <button
                    type="button"
                    key={it.id}
                    aria-label={label}
                    className={`cal-item cal-item--${it.layer}`}
                    style={{ top: pct(((start - startHour * 60) / span) * 100), height: pct(((end - start) / span) * 100), ...(it.color ? { background: it.color } : {}) }}
                    onClick={() => onItemClick?.(it)}
                  >
                    {renderItem ? renderItem(it) : (
                      <>
                        <span className="cal-item__time">{formatIn(it.start, zone, 'HH:mm')}</span>
                        <span className="cal-item__title">{it.title}</span>
                      </>
                    )}
                  </button>
                );
              })}

              {preview && (
                <div className="cal-week__preview" aria-hidden="true" style={{
                  top: pct(((preview.startMinute - startHour * 60) / span) * 100),
                  height: pct(((preview.endMinute - preview.startMinute) / span) * 100),
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One day: the week grid with a single column. */
export function DayView(props: WeekViewProps) {
  return <WeekView {...props} days={props.days.slice(0, 1)} className={`cal-day ${props.className ?? ''}`} />;
}
