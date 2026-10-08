import { useId, useState } from 'react';
import type { HolidayEditorState, HolidayRow } from '../hooks/useHolidayEditor';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';

export interface HolidayEditorProps {
  /** From useHolidayEditor. */
  editor: HolidayEditorState;
  /** The regions an admin can pick (code -> label). Omit to hide the picker. */
  regions?: Array<{ code: string; label: string }>;
  /**
   * Ask before removing a holiday. Products with their own confirm dialog pass it here;
   * the default is the browser's confirm.
   */
  confirmRemove?: (row: HolidayRow, question: string) => Promise<boolean>;
  describeError?: (error: unknown) => string;
  className?: string;
}

/** "Mon, Oct 12": a holiday is a calendar date, never a moment, so it is read in UTC. */
function dayLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? ymd
    : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

/**
 * The admin screen for public holidays, shared by every product (they are a jurisdiction's,
 * not a product's): review researched dates, correct the list, add what cannot be computed.
 */
export function HolidayEditor({ editor, regions, confirmRemove, describeError, className }: HolidayEditorProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.holidayFailed));
  const ask = confirmRemove ?? (async (_row: HolidayRow, q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

  const btn = cx('cal-btn', classNames.button);
  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);

  const add = async () => {
    if (!date || !name.trim()) return;
    if (await editor.add(date, name)) {
      setDate('');
      setName('');
    }
  };

  return (
    <section className={cx('cal-holidays', classNames.holidayEditor, className)} aria-labelledby={`${ids}-t`}>
      <div className="cal-holidays__head">
        <h3 className="cal-holidays__title" id={`${ids}-t`}>{labels.holidayTitle}</h3>
        <div className="cal-holidays__controls">
          {regions && regions.length > 0 ? (
            <label className="cal-holidays__field">
              <span className="cal-sr">{labels.holidayRegion}</span>
              <select className="cal-input" value={editor.region} onChange={(e) => editor.setRegion(e.target.value)}>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="cal-holidays__year" role="group" aria-label={labels.holidayYear}>
            <button type="button" className={btn} aria-label={labels.holidayPrevYear} onClick={() => editor.setYear(editor.year - 1)}>‹</button>
            <span className="cal-holidays__year-value">{editor.year}</span>
            <button type="button" className={btn} aria-label={labels.holidayNextYear} onClick={() => editor.setYear(editor.year + 1)}>›</button>
          </div>
        </div>
      </div>

      {editor.error ? <p className="cal-holidays__error" role="alert">{describe(editor.error)}</p> : null}

      {editor.waiting.length > 0 ? (
        <div className="cal-holidays__group cal-holidays__group--waiting">
          <p className="cal-holidays__group-title">{labels.holidayWaiting}</p>
          <p className="cal-holidays__hint">{labels.holidayWaitingHint}</p>
          <ul className="cal-holidays__list">
            {editor.waiting.map((row) => (
              <li key={row.date} className="cal-holidays__row">
                <span className="cal-holidays__date">{dayLabel(row.date)}</span>
                <span className="cal-holidays__name">
                  {row.name}
                  {row.estimated ? <span className="cal-holidays__badge">{labels.holidayEstimated}</span> : null}
                  {(row.sources ?? []).filter((s) => s.url).slice(0, 3).map((s) => (
                    <a key={s.url} className="cal-holidays__source" href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.domain || s.title || s.url}
                    </a>
                  ))}
                </span>
                <span className="cal-holidays__actions">
                  <button type="button" className={primary} disabled={editor.busy === row.date} onClick={() => void editor.confirm(row.date)}>
                    {labels.holidayConfirm}
                  </button>
                  <button type="button" className={btn} disabled={editor.busy === row.date} onClick={() => void editor.reject(row.date)}>
                    {labels.holidayReject}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="cal-holidays__group">
        <p className="cal-holidays__group-title">{labels.holidayList}</p>
        {editor.loading && editor.rows.length === 0 ? (
          <p className="cal-holidays__hint">{labels.holidayLoading}</p>
        ) : editor.holidays.length === 0 ? (
          <p className="cal-holidays__hint">{labels.holidayEmpty}</p>
        ) : (
          <ul className="cal-holidays__list">
            {editor.holidays.map((row) => (
              <li key={row.date} className="cal-holidays__row">
                <span className="cal-holidays__date">{dayLabel(row.date)}</span>
                <span className="cal-holidays__name">
                  {row.name}
                  <span className="cal-holidays__meta">{row.source === 'computed' ? labels.holidaySourceComputed : labels.holidaySourceManual}</span>
                </span>
                <span className="cal-holidays__actions">
                  <button
                    type="button"
                    className={btn}
                    disabled={editor.busy === row.date}
                    onClick={async () => {
                      if (await ask(row, labels.holidayRemoveAsk(row.name, dayLabel(row.date)))) void editor.remove(row.date);
                    }}
                  >
                    {labels.holidayRemove}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor.removed.length > 0 ? (
        <div className="cal-holidays__group">
          <p className="cal-holidays__group-title">{labels.holidayRemoved}</p>
          <ul className="cal-holidays__list">
            {editor.removed.map((row) => (
              <li key={row.date} className="cal-holidays__row cal-holidays__row--muted">
                <span className="cal-holidays__date">{dayLabel(row.date)}</span>
                <span className="cal-holidays__name">
                  {row.name}
                  {row.status === 'rejected' ? <span className="cal-holidays__meta">{labels.holidayRejected}</span> : null}
                </span>
                <span className="cal-holidays__actions">
                  {row.status === 'confirmed' ? (
                    <button type="button" className={btn} disabled={editor.busy === row.date} onClick={() => void editor.putBack(row)}>
                      {labels.holidayPutBack}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="cal-holidays__add"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <p className="cal-holidays__group-title">{labels.holidayAddTitle}</p>
        <div className="cal-holidays__add-fields">
          <label className="cal-holidays__field">
            <span className="cal-holidays__label">{labels.holidayAddDate}</span>
            <input
              className="cal-input"
              type="date"
              value={date}
              min={`${editor.year}-01-01`}
              max={`${editor.year}-12-31`}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="cal-holidays__field cal-holidays__field--grow">
            <span className="cal-holidays__label">{labels.holidayAddName}</span>
            <input className="cal-input" type="text" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button type="submit" className={primary} disabled={!date || !name.trim() || editor.busy !== null}>
            {labels.holidayAdd}
          </button>
        </div>
      </form>
    </section>
  );
}
