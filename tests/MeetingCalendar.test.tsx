import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MEETING_STATUS_COLORS, MeetingCalendar } from '../src';

const meetings = [
  { id: 'm-1', start: '2026-10-13T14:00:00Z', end: '2026-10-13T14:30:00Z', title: 'First call', status: 'pending_approval', data: { id: 'm-1' } },
  { id: 'm-2', start: '2026-10-15T15:00:00Z', end: '2026-10-15T15:30:00Z', title: 'Review', status: 'confirmed', data: { id: 'm-2' } },
];

describe('MeetingCalendar', () => {
  it('draws the bar, the grid and a legend built from the same colours as the meetings', () => {
    render(<MeetingCalendar meetings={meetings} zone="UTC" view="month" initialDate={new Date('2026-10-11T12:00:00Z')} onMeetingClick={() => {}} onViewChange={() => {}} />);

    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy();
    const legend = screen.getByRole('list', { name: 'Status' });
    expect(legend.textContent).toContain('Awaiting approval');
    expect(legend.querySelectorAll('li')).toHaveLength(Object.keys(MEETING_STATUS_COLORS).length);
    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('pages and tells the product where the reader went', () => {
    const onPeriodChange = vi.fn();
    render(<MeetingCalendar meetings={[]} zone="UTC" view="month" initialDate={new Date('2026-10-11T12:00:00Z')} onMeetingClick={() => {}} onPeriodChange={onPeriodChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy();
    expect(onPeriodChange).toHaveBeenCalledTimes(1);
  });

  it('hands the meeting back on click and shows the busy legend only when asked', () => {
    const onMeetingClick = vi.fn();
    render(<MeetingCalendar meetings={meetings} zone="UTC" view="month" initialDate={new Date('2026-10-11T12:00:00Z')} onMeetingClick={onMeetingClick} showBusy busyStale />);

    fireEvent.click(screen.getByText(/Review/));
    expect(onMeetingClick.mock.calls[0]?.[0].id).toBe('m-2');
    expect(screen.getByText(/some busy time may be missing/)).toBeTruthy();
  });
});
