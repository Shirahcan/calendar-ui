import { useId, useState, type ReactNode } from 'react';
import { useAvailabilitySchedule, type AvailabilityAdapter } from '../hooks/useAvailabilitySchedule';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';
import { DateChanges } from './availability/DateChanges';
import { PublicHolidays } from './availability/PublicHolidays';
import { TimeOff } from './availability/TimeOff';
import { WeekRibbon } from './availability/WeekRibbon';
import { WeeklyHours } from './availability/WeeklyHours';

export type AvailabilitySection = 'weekly' | 'dates' | 'timeoff' | 'holidays';

export interface AvailabilityEditorProps {
  adapter: AvailabilityAdapter;
  /** Which tabs, in order. MployNow hosts that only add dates can drop `weekly`. */
  sections?: AvailabilitySection[];
  /** Show the time-zone picker (off when the product keeps the zone on the person's profile). */
  showZone?: boolean;
  /** The product's own settings that belong with availability (a buffer, a notice period). */
  extra?: ReactNode;
  describeError?: (error: unknown) => string;
  className?: string;
}

/** The product's choices, plus the schedule's own value when an admin has since removed it. */
function bufferChoices(choices: number[], current: number | undefined): number[] {
  return current === undefined || choices.includes(current) ? choices : [...choices, current].sort((a, b) => a - b);
}

function zones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };

  return intl.supportedValuesOf?.('timeZone') ?? [];
}

/**
 * A person's availability, the same screen in every product: weekly hours, date changes, time
 * off and public holidays, on calendar-service's spec (the service is the authority; the product
 * only passes it through). Saving replaces the whole spec, so the screen and the service never
 * disagree about what was saved.
 */
export function AvailabilityEditor({ adapter, sections = ['weekly', 'dates', 'timeoff', 'holidays'], showZone = false, extra, describeError, className }: AvailabilityEditorProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const s = useAvailabilitySchedule(adapter);
  const [tab, setTab] = useState<AvailabilitySection>(sections[0] ?? 'weekly');
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.availFailed));
  const busy = s.saving || !s.ready;
  const titles: Record<AvailabilitySection, string> = {
    weekly: labels.availTabWeekly,
    dates: labels.availTabDates,
    timeoff: labels.availTabTimeOff,
    holidays: labels.availTabHolidays,
  };

  return (
    <section className={cx('cal-avail', classNames.availabilityEditor, className)} aria-labelledby={`${ids}-t`}>
      <header className="cal-avail__head">
        <h3 className="cal-avail__title" id={`${ids}-t`}>{labels.availTitle}</h3>
        {s.ready ? <p className="cal-avail__intro">{labels.availIntro(s.spec.timezone.zone)}</p> : null}
      </header>

      {!s.ready && !s.error ? <p className="cal-avail__empty">{labels.availLoading}</p> : null}
      {s.error ? <p className="cal-avail__error" role="alert">{describe(s.error)}</p> : null}

      {s.ready ? (
        <>
          <WeekRibbon spec={s.spec} />

          {showZone ? (
            <label className="cal-avail__field cal-avail__zone">
              {labels.availZone}
              <select className="cal-input" value={s.spec.timezone.zone} disabled={busy} onChange={(e) => s.edit({ type: 'setZone', zone: e.target.value })}>
                {(zones().includes(s.spec.timezone.zone) ? zones() : [s.spec.timezone.zone, ...zones()]).map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </label>
          ) : null}

          {s.policy ? (
            <label className="cal-avail__field cal-avail__buffer">
              {labels.availBuffer}
              <select
                className="cal-input"
                value={String(s.spec.buffer ?? s.policy.default_buffer_minutes)}
                disabled={busy}
                onChange={(e) => s.edit({ type: 'setBuffer', minutes: Number(e.target.value) })}
              >
                {bufferChoices(s.policy.buffer_choices, s.spec.buffer).map((m) => (
                  <option key={m} value={String(m)}>{labels.availMinutes(m)}</option>
                ))}
              </select>
              <span className="cal-avail__hint">{labels.availBufferHelp}</span>
            </label>
          ) : null}

          {sections.length > 1 ? (
            <div className="cal-avail__tabs" role="tablist">
              {sections.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`${ids}-${key}`}
                  aria-selected={tab === key}
                  aria-controls={`${ids}-${key}-panel`}
                  className={cx('cal-avail__tab', tab === key && 'cal-avail__tab--on')}
                  onClick={() => setTab(key)}
                >
                  {titles[key]}
                </button>
              ))}
            </div>
          ) : null}

          <div role="tabpanel" id={`${ids}-${tab}-panel`} aria-labelledby={`${ids}-${tab}`} className="cal-avail__panel">
            {tab === 'weekly' && s.policy ? <WeeklyHours spec={s.spec} policy={s.policy} edit={s.edit} disabled={busy} /> : null}
            {tab === 'dates' ? <DateChanges spec={s.spec} edit={s.edit} disabled={busy} /> : null}
            {tab === 'timeoff' ? <TimeOff spec={s.spec} edit={s.edit} disabled={busy} /> : null}
            {tab === 'holidays' ? <PublicHolidays spec={s.spec} edit={s.edit} regions={s.regions} holidays={adapter.holidays} disabled={busy} /> : null}
          </div>

          {extra ? <div className="cal-avail__extra">{extra}</div> : null}

          {s.problems.length > 0 ? (
            <ul className="cal-avail__problems" role="alert">
              {s.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : null}

          <footer className="cal-avail__bar">
            {s.dirty ? <span className="cal-avail__status">{labels.availUnsaved}</span> : s.justSaved ? <span className="cal-avail__status" role="status">{labels.availSaved}</span> : <span />}
            <div className="cal-avail__bar-actions">
              {s.dirty ? (
                <button type="button" className={cx('cal-btn cal-btn--ghost', classNames.button)} disabled={s.saving} onClick={s.discard}>
                  {labels.availDiscard}
                </button>
              ) : null}
              <button type="button" className={cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary)} disabled={!s.dirty || s.saving || s.problems.length > 0} onClick={() => void s.save()}>
                {labels.availSave}
              </button>
            </div>
          </footer>
        </>
      ) : null}
    </section>
  );
}
