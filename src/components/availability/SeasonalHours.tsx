import { useState } from 'react';
import type { AvailabilitySpec, DayName, SchedulingPolicy, WeeklyRule } from '../../types';
import type { EditorAction } from '../../hooks/useAvailabilityEditor';
import { cx, useCalendarUi } from '../../theme';
import { dateLabel } from './DateChanges';
import { WEEK } from './WeekRibbon';

/** Today as YYYY-MM-DD on this device, the day a person reads "ended" against. */
function todayYmd(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A row of the list: a weekly rule with dates of its own, or one rule of a period. */
interface SeasonRow {
  key: string;
  rule: WeeklyRule;
  from: string | null;
  until: string | null;
  remove: EditorAction;
}

function rows(spec: AvailabilitySpec): SeasonRow[] {
  const out: SeasonRow[] = [];
  (spec.weekly ?? []).forEach((rule, index) => {
    if (rule.valid_from || rule.valid_until) {
      out.push({ key: `w${index}`, rule, from: rule.valid_from ?? null, until: rule.valid_until ?? null, remove: { type: 'removeWeekly', index } });
    }
  });
  (spec.periods ?? []).forEach((p, index) => {
    p.weekly.forEach((rule, j) => {
      out.push({ key: `p${index}-${j}`, rule, from: p.from, until: p.to, remove: { type: 'removePeriod', index } });
    });
  });

  return out.sort((a, b) => (a.from ?? '').localeCompare(b.from ?? '') || (a.until ?? '9999').localeCompare(b.until ?? '9999'));
}

/**
 * Weekly hours that start or stop on a date (a busy season, a temporary schedule). The days above
 * are the every-week pattern and leave these alone; without this list a person could neither see
 * hours that were open for them nor take them away.
 */
export function SeasonalHours({ spec, policy, edit, disabled, windowLengths = false, usualLength }: {
  spec: AvailabilitySpec;
  policy: SchedulingPolicy;
  edit: (a: EditorAction) => void;
  disabled?: boolean;
  windowLengths?: boolean;
  usualLength?: number;
}) {
  const { labels, classNames } = useCalendarUi();
  const btn = cx('cal-btn', classNames.button);
  const seed = policy.seed_weekly[0];
  const [days, setDays] = useState<DayName[]>([]);
  const [start, setStart] = useState(seed?.start ?? '09:00');
  const [end, setEnd] = useState(seed?.end ?? '17:00');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [length, setLength] = useState('');
  const [today] = useState(todayYmd);
  const lengths = windowLengths ? policy.duration_choices ?? [] : [];
  const list = rows(spec);
  const backwards = from !== '' && until !== '' && until < from;
  const canAdd = days.length > 0 && (from !== '' || until !== '') && !backwards && start !== end;

  const add = () => {
    if (!canAdd) return;
    const ordered = WEEK.filter((d) => days.includes(d));
    edit({
      type: 'addWeekly',
      rule: {
        days: ordered,
        start,
        end,
        ...(from ? { valid_from: from } : {}),
        ...(until ? { valid_until: until } : {}),
        ...(length ? { length: Number(length) } : {}),
      },
    });
    setDays([]);
    setFrom('');
    setUntil('');
    setLength('');
  };

  return (
    <div className="cal-avail__section cal-avail__season">
      <h4 className="cal-avail__subtitle">{labels.availSeasonTitle}</h4>
      <p className="cal-avail__intro">{labels.availSeasonIntro}</p>

      {list.length === 0 ? (
        <p className="cal-avail__empty">{labels.availSeasonNone}</p>
      ) : (
        <ul className="cal-avail__list">
          {list.map((r) => {
            const ended = r.until !== null && r.until < today;

            return (
              <li key={r.key} className={cx('cal-avail__item', ended && 'cal-avail__item--ended')}>
                <span className="cal-avail__item-date">
                  {labels.availSeasonWhen(r.from ? dateLabel(r.from) : null, r.until ? dateLabel(r.until) : null)}
                </span>
                <span className="cal-avail__item-what">
                  {labels.availSeasonHours(
                    r.rule.days.map((d) => labels.availDayNames[d]).join(', '),
                    r.rule.start,
                    r.rule.end,
                    r.rule.length ?? null,
                  )}
                  {ended ? ` (${labels.availSeasonEnded})` : ''}
                </span>
                <button type="button" className={cx(btn, 'cal-btn--ghost')} disabled={disabled} onClick={() => edit(r.remove)}>
                  {labels.availRemove}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <fieldset className="cal-avail__season-days" disabled={disabled}>
        <legend className="cal-avail__field">{labels.availSeasonDays}</legend>
        {WEEK.map((d) => (
          <label key={d} className="cal-avail__check">
            <input
              type="checkbox"
              checked={days.includes(d)}
              onChange={(e) => setDays((was) => (e.target.checked ? [...was, d] : was.filter((x) => x !== d)))}
            />
            {labels.availDayNames[d]}
          </label>
        ))}
      </fieldset>

      <div className="cal-avail__form">
        <label className="cal-avail__field">
          {labels.availFrom}
          <input className="cal-input" type="time" step={900} value={start} disabled={disabled} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="cal-avail__field">
          {labels.availTo}
          <input className="cal-input" type="time" step={900} value={end} disabled={disabled} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className="cal-avail__field">
          {labels.availSeasonStarts}
          <input className="cal-input" type="date" value={from} disabled={disabled} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="cal-avail__field">
          {labels.availSeasonEnds}
          <input className="cal-input" type="date" value={until} min={from || undefined} disabled={disabled} onChange={(e) => setUntil(e.target.value)} />
        </label>
        {lengths.length > 0 ? (
          <label className="cal-avail__field">
            {labels.availSeasonLength}
            <select className="cal-input" value={length} disabled={disabled} onChange={(e) => setLength(e.target.value)}>
              <option value="">{usualLength ? `${labels.availLengthUsual} (${labels.availMinutes(usualLength)})` : labels.availLengthUsual}</option>
              {lengths.map((m) => (
                <option key={m} value={String(m)}>{labels.availMinutes(m)}</option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className={btn} disabled={disabled || !canAdd} onClick={add}>
          {labels.availSeasonAdd}
        </button>
      </div>
      {backwards ? (
        <p className="cal-avail__hint" role="alert">{labels.availSeasonBackwards}</p>
      ) : days.length > 0 && from === '' && until === '' ? (
        <p className="cal-avail__hint">{labels.availSeasonNeedsDate}</p>
      ) : null}
    </div>
  );
}
