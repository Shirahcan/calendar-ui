import { useId } from 'react';
import { cx, useCalendarUi } from '../theme';

/** Every meeting status a calendar can filter by, in the order people read them. */
export const MEETING_STATUSES = ['pending_approval', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'] as const;

export interface MeetingStatusFilterProps {
  /** The status shown, or null for every status. */
  value: string | null;
  onChange: (status: string | null) => void;
  /** The statuses to offer (default: every one). */
  statuses?: readonly string[];
  /** Show the visible "Status" label beside it (a top bar usually does not). */
  showLabel?: boolean;
  className?: string;
}

/**
 * Which meetings a calendar shows, by status: the same compact select on every calendar in every
 * product (owner 2026-10-13: one control, not a "Filters" card). Words come from the package's
 * `meetingStatus` labels, so the filter and the calendar legend always agree.
 */
export function MeetingStatusFilter({ value, onChange, statuses = MEETING_STATUSES, showLabel = false, className }: MeetingStatusFilterProps) {
  const { labels, classNames } = useCalendarUi();
  const id = useId();

  return (
    <span className={cx('cal-status-filter', classNames.statusFilter, className)}>
      <label htmlFor={id} className={showLabel ? 'cal-status-filter__label' : 'cal-sr-only'}>{labels.statusFilterLabel}</label>
      <select
        id={id}
        className={cx('cal-input cal-status-filter__select', classNames.input)}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">{labels.statusFilterAll}</option>
        {statuses.map((s) => (
          <option key={s} value={s}>{labels.meetingStatus(s)}</option>
        ))}
      </select>
    </span>
  );
}
