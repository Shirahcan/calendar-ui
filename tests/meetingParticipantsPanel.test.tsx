import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MeetingParticipantsPanel, type MeetingParticipantView } from '../src/components/MeetingParticipantsPanel';

const people: MeetingParticipantView[] = [
  { id: 'host:1', name: 'Elena Rodriguez', email: 'elena@example.com', kind: 'organizer', response: 'accepted' },
  { id: 'p:2', name: 'Maria Garcia', email: 'maria@example.com', kind: 'booker', response: 'pending', zone: 'America/Edmonton' },
  { id: 'p:3', name: 'Ana Interpreter', email: 'ana@example.com', kind: 'attendee', removable: true },
];
const at = { start_utc: '2026-10-11T14:00:00Z', end_utc: '2026-10-11T14:30:00Z' };

describe('MeetingParticipantsPanel', () => {
  it('names each place on the call and the meeting on a person’s own clock when given', () => {
    render(<MeetingParticipantsPanel participants={people} {...at} />);
    expect(screen.getByText('Host')).toBeTruthy();
    expect(screen.getByText('Client')).toBeTruthy();
    expect(screen.getByText('Their time: Sun, Oct 11, 2026, 8:00 AM - 8:30 AM MDT')).toBeTruthy();
    expect(screen.getAllByText(/Their time/)).toHaveLength(1);
    expect(screen.queryByText('Invite someone')).toBeNull();
  });

  it('invites someone through the product, and refuses a bad email without calling it', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<MeetingParticipantsPanel participants={people} {...at} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Invite'));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'tom@example.com' } });
    fireEvent.click(screen.getByLabelText('Optional'));
    fireEvent.click(screen.getByText('Invite'));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ email: 'tom@example.com', name: undefined, optional: true }));
  });

  it('shows the reason when the product refuses', async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error('They are already on this meeting.'));
    render(<MeetingParticipantsPanel participants={people} {...at} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'maria@example.com' } });
    fireEvent.click(screen.getByText('Invite'));
    expect(await screen.findByText('They are already on this meeting.')).toBeTruthy();
  });
});
