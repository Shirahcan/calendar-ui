import { useState } from 'react';
import type { AvailabilitySpec, DayName, SchedulingPolicy, WeeklyRule } from '../../types';
import type { EditorAction } from '../../hooks/useAvailabilityEditor';
import { cx, useCalendarUi } from '../../theme';
import { dateLabel } from './DateChanges';
import { WEEK } from './WeekRibbon';
import { ModalShell } from '../ModalShell';

/** A date as YYYY-MM-DD on this device, `plusDays` from today (today: the day "ended" is read against). */
function todayYmd(plusDays = 0): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + plusDays);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** How long a new period starts out when hours need dates: two weeks from today (the owner's example). */
const DEFAULT_PERIOD_DAYS = 14;

/** A row of the list: a weekly rule with dates of its own, or one rule of a period. */
interface SeasonRow {
  key: string;
  rule: WeeklyRule;
  from: string | null;
  until: string | null;
  remove: EditorAction;
}

/** `all`: open-ended rows too (when hours need dates they are listed, so they can be fixed). */
function rows(spec: AvailabilitySpec, all = false): SeasonRow[] {
  const out: SeasonRow[] = [];
  (spec.weekly ?? []).forEach((rule, index) => {
    if (all || rule.valid_from || rule.valid_until) {
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
 *
 * The list stays on the page; adding opens a modal (owner, 2026-10-21): the form was six fields
 * and seven day boxes laid open under every editor, which is most of a screen for something a
 * person does a few times a year.
 *
 * With `dated` (the product's policy `weekly_hours_need_dates`, MployNow 2026-10-23) this IS the
 * weekly hours: there is no every-week pattern above it, a period needs both dates, a new one
 * starts as the next two weeks, and a row left with no end date is listed as one to fix.
 */
export function SeasonalHours({ spec, policy, edit, disabled, windowLengths = false, usualLength, dated = false }: {
  spec: AvailabilitySpec;
  policy: SchedulingPolicy;
  edit: (a: EditorAction) => void;
  disabled?: boolean;
  windowLengths?: boolean;
  usualLength?: number;
  dated?: boolean;
}) {
  const { labels, classNames } = useCalendarUi();
  const btn = cx('cal-btn', classNames.button);
  const seed = policy.seed_weekly[0];
  const [days, setDays] = useState<DayName[]>([]);
  const [start, setStart] = useState(seed?.start ?? '09:00');
  const [end, setEnd] = useState(seed?.end ?? '17:00');
  const [from, setFrom] = useState(() => (dated ? todayYmd() : ''));
  const [until, setUntil] = useState(() => (dated ? todayYmd(DEFAULT_PERIOD_DAYS - 1) : ''));
  const [length, setLength] = useState('');
  const [today] = useState(() => todayYmd());
  const [open, setOpen] = useState(false);
  const lengths = windowLengths ? policy.duration_choices ?? [] : [];
  const list = rows(spec, dated);
  const backwards = from !== '' && until !== '' && until < from;
  const hasDates = dated ? from !== '' && until !== '' : from !== '' || until !== '';
  const canAdd = days.length > 0 && hasDates && !backwards && start !== end;
  const title = dated ? labels.availPeriodTitle : labels.availSeasonTitle;
  const intro = dated ? labels.availPeriodIntro : labels.availSeasonIntro;

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
    close();
  };

  const close = () => {
    setDays([]);
    setFrom(dated ? todayYmd() : '');
    setUntil(dated ? todayYmd(DEFAULT_PERIOD_DAYS - 1) : '');
    setLength('');
    setOpen(false);
  };

  return (
    <div className="cal-avail__section cal-avail__season">
      <h4 className="cal-avail__subtitle">{title}</h4>
      <p className="cal-avail__intro">{intro}</p>

      {list.length === 0 ? (
        <p className="cal-avail__empty">{dated ? labels.availPeriodNone : labels.availSeasonNone}</p>
      ) : (
        <ul className="cal-avail__list">
          {list.map((r) => {
            const ended = r.until !== null && r.until < today;
            const openEnded = dated && (r.from === null || r.until === null);

            return (
              <li key={r.key} className={cx('cal-avail__item', ended && 'cal-avail__item--ended', openEnded && 'cal-avail__item--open')}>
                <span className="cal-avail__item-date">
                  {r.from === null && r.until === null ? '' : labels.availSeasonWhen(r.from ? dateLabel(r.from) : null, r.until ? dateLabel(r.until) : null)}
                </span>
                <span className="cal-avail__item-what">
                  {labels.availSeasonHours(
                    r.rule.days.map((d) => labels.availDayNames[d]).join(', '),
                    r.rule.start,
                    r.rule.end,
                    r.rule.length ?? null,
                  )}
                  {ended ? ` (${labels.availSeasonEnded})` : openEnded ? ` (${labels.availPeriodNoEnd})` : ''}
                </span>
                <button type="button" className={cx(btn, 'cal-btn--ghost')} disabled={disabled} onClick={() => edit(r.remove)}>
                  {labels.availRemove}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className={cx(btn, 'cal-avail__season-open')} disabled={disabled} onClick={() => setOpen(true)}>
        {dated ? labels.availPeriodOpen : labels.availSeasonOpen}
      </button>

      {open ? (
        <ModalShell
          title={title}
          onClose={close}
          className="cal-avail__season-modal"
          footer={
            <>
              <button type="button" className={cx(btn, 'cal-btn--ghost')} onClick={close}>
                {labels.notesCancel}
              </button>
              <button type="button" className={btn} disabled={disabled || !canAdd} onClick={add}>
                {labels.availSeasonAdd}
              </button>
            </>
          }
        >
          <p className="cal-modal__text">{intro}</p>
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
              <input className="cal-input" type="date" value={from} required={dated} disabled={disabled} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="cal-avail__field">
              {labels.availSeasonEnds}
              <input className="cal-input" type="date" value={until} min={from || undefined} required={dated} disabled={disabled} onChange={(e) => setUntil(e.target.value)} />
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
          </div>
          {backwards ? (
            <p className="cal-avail__hint" role="alert">{labels.availSeasonBackwards}</p>
          ) : days.length > 0 && !hasDates ? (
            <p className="cal-avail__hint">{dated ? labels.availPeriodNeedsDates : labels.availSeasonNeedsDate}</p>
          ) : null}
        </ModalShell>
      ) : null}
    </div>
  );
}
