import { useState } from 'react';
import { addDays, addMonths, endOfMonth, format, parse, startOfMonth, startOfWeek } from 'date-fns';
import type { WeekStart } from '../time';
import { cx, useCalendarUi } from '../theme';

/** How many open times a day has, as a booker reads it at a glance. */
export type AvailabilityLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * The one rule for how a day's open-time count reads (every product's booking month uses it, so
 * "a few" means the same everywhere): 1-2 a few, 3-7 some, 8 or more many.
 */
export function availabilityLevel(count: number): AvailabilityLevel {
  if (count >= 8) return 'high';
  if (count >= 3) return 'medium';
  if (count >= 1) return 'low';
  return 'none';
}

export interface AvailabilityMonthProps {
  /** The month shown, `yyyy-MM`. */
  month: string;
  /** Open times per day, keyed `yyyy-MM-dd` in the BOOKER's zone (calendar-service's counts). */
  counts: Record<string, number>;
  /** Today in the booker's zone, `yyyy-MM-dd`: earlier days cannot be picked. */
  today: string;
  /** The last day a booker may pick (the scheduling policy's horizon), `yyyy-MM-dd`. */
  lastBookable?: string | null;
  selected?: string | null;
  onSelect: (day: string) => void;
  onMonthChange: (month: string) => void;
  loading?: boolean;
  /** A reason the month could not be read; shown with a retry. */
  error?: string | null;
  onRetry?: () => void;
  weekStartsOn?: WeekStart;
  className?: string;
}

const toMonth = (key: string): Date => parse(`${key}-01`, 'yyyy-MM-dd', new Date());
const monthKey = (d: Date): string => format(d, 'yyyy-MM');

/**
 * The booking month: every day shaded by how many times are open on it, in one hue at three
 * strengths (it says "how many", never "good or bad"), with month and year navigation bounded by
 * today and the policy's horizon. It never calls the service: the product passes the counts.
 */
export function AvailabilityMonth({
  month, counts, today, lastBookable, selected, onSelect, onMonthChange, loading, error, onRetry, weekStartsOn = 0, className,
}: AvailabilityMonthProps) {
  const { labels } = useCalendarUi();
  const [picking, setPicking] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => toMonth(month).getFullYear());

  const shown = toMonth(month);
  const firstMonth = today.slice(0, 7);
  const lastMonth = lastBookable ? lastBookable.slice(0, 7) : null;
  const canPrev = month > firstMonth;
  const canNext = lastMonth === null || month < lastMonth;
  const monthOpen = (key: string) => key >= firstMonth && (lastMonth === null || key <= lastMonth);

  const gridStart = startOfWeek(startOfMonth(shown), { weekStartsOn });
  const gridEnd = endOfMonth(shown);
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd || days.length % 7 !== 0; d = addDays(d, 1)) {
    days.push(d);
  }
  const weekdays = days.slice(0, 7).map((d) => format(d, 'EEE'));
  const total = Object.entries(counts).reduce((sum, [key, n]) => (key.startsWith(month) ? sum + n : sum), 0);

  const go = (offset: number) => onMonthChange(monthKey(addMonths(shown, offset)));

  return (
    <div className={cx('cal-amonth', className)} aria-busy={loading || undefined}>
      <div className="cal-amonth__nav">
        <button type="button" className="cal-amonth__step" onClick={() => go(-1)} disabled={!canPrev || loading} aria-label={labels.previousMonth}>
          <span aria-hidden="true">‹</span>
        </button>
        <button type="button" className="cal-amonth__title" aria-expanded={picking} aria-label={labels.chooseMonth}
          onClick={() => { setPickerYear(shown.getFullYear()); setPicking((v) => !v); }}>
          {format(shown, 'MMMM yyyy')} <span aria-hidden="true">▾</span>
        </button>
        <button type="button" className="cal-amonth__step" onClick={() => go(1)} disabled={!canNext || loading} aria-label={labels.nextMonth}>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {picking && (
        <div className="cal-amonth__picker" role="group" aria-label={labels.chooseMonth}>
          <div className="cal-amonth__years">
            <button type="button" className="cal-amonth__step" aria-label={labels.previousYear}
              disabled={`${pickerYear - 1}-12` < firstMonth} onClick={() => setPickerYear((y) => y - 1)}>‹</button>
            <span>{pickerYear}</span>
            <button type="button" className="cal-amonth__step" aria-label={labels.nextYear}
              disabled={lastMonth !== null && `${pickerYear + 1}-01` > lastMonth} onClick={() => setPickerYear((y) => y + 1)}>›</button>
          </div>
          <div className="cal-amonth__months">
            {Array.from({ length: 12 }, (_, i) => {
              const key = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
              return (
                <button type="button" key={key} disabled={!monthOpen(key)} aria-current={key === month ? 'date' : undefined}
                  className={cx('cal-amonth__month', key === month && 'is-current')}
                  onClick={() => { onMonthChange(key); setPicking(false); }}>
                  {format(toMonth(key), 'MMM')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error ? (
        <div className="cal-amonth__error" role="alert">
          <p>{error}</p>
          {onRetry && <button type="button" className="cal-amonth__retry" onClick={onRetry}>{labels.tryAgain}</button>}
        </div>
      ) : (
        <>
          <div className="cal-amonth__grid" role="grid" aria-label={format(shown, 'MMMM yyyy')}>
            {weekdays.map((w) => <div key={w} role="columnheader" className="cal-amonth__weekday">{w}</div>)}
            {days.map((d) => {
              const key = format(d, 'yyyy-MM-dd');
              const inMonth = key.startsWith(month);
              const count = inMonth ? (counts[key] ?? 0) : 0;
              const outOfRange = key < today || (lastBookable != null && key > lastBookable);
              const level = loading ? 'none' : availabilityLevel(count);
              const pickable = inMonth && !outOfRange && count > 0 && !loading;
              return (
                <button type="button" key={key} role="gridcell" disabled={!pickable}
                  aria-selected={selected === key} aria-label={`${format(d, 'EEEE d MMMM')}: ${labels.openTimes(count)}`}
                  className={cx('cal-amonth__day', `is-${level}`, !inMonth && 'is-outside', selected === key && 'is-selected', key === today && 'is-today')}
                  onClick={() => onSelect(key)}>
                  <span className="cal-amonth__num">{format(d, 'd')}</span>
                  {inMonth && count > 0 && !outOfRange && <span className="cal-amonth__count">{labels.openTimesShort(count)}</span>}
                </button>
              );
            })}
          </div>

          <ul className="cal-amonth__legend" aria-label={labels.availabilityLegend}>
            {(['high', 'medium', 'low', 'none'] as const).map((l) => (
              <li key={l}><span className={cx('cal-amonth__swatch', `is-${l}`)} aria-hidden="true" />{labels.availabilityLevel(l)}</li>
            ))}
          </ul>

          {loading && <p className="cal-amonth__note">{labels.loadingMonth}</p>}
          {!loading && total === 0 && <p className="cal-amonth__note">{labels.noOpenDays}</p>}
        </>
      )}
    </div>
  );
}
