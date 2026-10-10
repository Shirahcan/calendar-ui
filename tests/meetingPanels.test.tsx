import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MeetingActions, MeetingDetails, MeetingPeople, MeetingSummary, meetingLinkState, type MeetingView } from '../src/components/MeetingPanels';
import { DEFAULT_LABELS } from '../src/theme';

const meeting = (over: Partial<MeetingView> = {}): MeetingView => ({
  title: 'Study permit review', status: 'scheduled', statusLabel: 'Scheduled',
  start_utc: '2026-10-11T14:00:00Z', end_utc: '2026-10-11T14:30:00Z', where: 'Portify video room', video: true, live: true,
  join_opens_at: '2026-10-11T13:30:00Z', join_closes_at: '2026-10-11T15:00:00Z', about: 'Go through the study plan.',
  booked_at: '2026-10-09T14:30:00Z',
  people: [{ role: 'Client', name: 'Maria Garcia', email: 'maria@example.com' }, { role: 'Consultant', name: 'Elena Rodriguez' }],
  ...over,
});

describe('meeting page panels', () => {
  it('says when the room opens, on the viewer clock with the short zone name', () => {
    const now = new Date('2026-10-10T12:00:00Z').getTime();
    render(<MeetingSummary meeting={meeting()} timezone="Africa/Lagos" now={now} />);

    expect(screen.getByText('3:00 PM - 3:30 PM WAT')).toBeTruthy();
    expect(screen.getByText('Opens at 2:30 PM WAT')).toBeTruthy();
    expect(screen.getByText('30 minutes before the start. Join from this page then.')).toBeTruthy();
    expect(screen.getByText('Go through the study plan.')).toBeTruthy();
  });

  it('reads open, closed, or no video link as it is', () => {
    const m = meeting();
    expect(meetingLinkState(m, new Date('2026-10-11T13:45:00Z').getTime(), 'UTC', DEFAULT_LABELS).value).toBe('Open now');
    expect(meetingLinkState(m, new Date('2026-10-11T15:30:00Z').getTime(), 'UTC', DEFAULT_LABELS).value).toBe('Closed');
    expect(meetingLinkState(meeting({ live: false }), 0, 'UTC', DEFAULT_LABELS).value).toBe('Closed');
    expect(meetingLinkState(meeting({ video: false }), 0, 'UTC', DEFAULT_LABELS).value).toBe('No video link');
  });

  it('lists the people and names the clock in full in the details', () => {
    render(<><MeetingPeople meeting={meeting()} /><MeetingDetails meeting={meeting()} timezone="Africa/Lagos" /></>);

    expect(screen.getByText('Maria Garcia')).toBeTruthy();
    expect(screen.getByText('maria@example.com')).toBeTruthy();
    expect(screen.getByText('30 minutes')).toBeTruthy();
    expect(screen.getByText('West Africa Standard Time')).toBeTruthy();
  });

  it('says who has answered before the call, and who came after it', () => {
    const before = meeting({ people: [
      { role: 'Client', name: 'Maria Garcia', response: 'pending' },
      { role: 'Consultant', name: 'Elena Rodriguez', response: 'accepted' },
    ] });
    const { rerender } = render(<MeetingPeople meeting={before} />);
    expect(screen.getByText('Awaiting answer')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();

    // Attendance, once known, is what matters: it replaces the answer.
    rerender(<MeetingPeople meeting={meeting({ people: [
      { role: 'Client', name: 'Maria Garcia', response: 'accepted', attendance: 'no_show' },
      { role: 'Consultant', name: 'Elena Rodriguez', attendance: 'attended' },
    ] })} />);
    expect(screen.getByText('Did not join')).toBeTruthy();
    expect(screen.getByText('Joined the call')).toBeTruthy();
    expect(screen.queryByText('Confirmed')).toBeNull();
  });

  it('offers the product actions it is given, and nothing when there are none', () => {
    const cancel = vi.fn();
    const { container, rerender } = render(<MeetingActions actions={[{ key: 'cancel', label: 'Cancel meeting', onSelect: cancel, danger: true }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel meeting' }));
    expect(cancel).toHaveBeenCalled();

    rerender(<MeetingActions actions={[]} />);
    expect(container.textContent).toBe('');
  });
});
