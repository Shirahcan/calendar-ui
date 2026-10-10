import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CancelMeetingDialog, MeetingQuickView, RescheduleDialog } from '../src/components/MeetingDialogs';
import type { MeetingView } from '../src/components/MeetingPanels';
import type { Slot } from '../src/types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
});

const meeting: MeetingView = {
  title: 'Study permit review', status: 'scheduled', statusLabel: 'Scheduled',
  start_utc: '2026-10-12T14:00:00Z', end_utc: '2026-10-12T14:30:00Z', where: 'Video call', video: true, live: true,
  join_opens_at: '2026-10-12T13:30:00Z', join_closes_at: '2026-10-12T15:00:00Z',
  people: [{ role: 'Client', name: 'Maria Garcia' }],
};
const now = new Date('2026-10-10T12:00:00Z').getTime();

describe('MeetingQuickView', () => {
  it('offers ONE main action for the moment, and the rest behind one kebab', () => {
    const onOpenPage = vi.fn();
    const onJoin = vi.fn();
    const cancel = vi.fn();
    const { rerender } = render(
      <MeetingQuickView meeting={meeting} timezone="Africa/Lagos" now={now} roomOpen={false} onJoin={onJoin} onOpenPage={onOpenPage} onClose={() => undefined}
        actions={[{ key: 'cancel', label: 'Cancel meeting', danger: true, onSelect: cancel }, { key: 'move', label: 'Reschedule', onSelect: () => undefined }]} />,
    );

    // People is folded by default; the title row still names them.
    const people = screen.getByText('Maria Garcia', { selector: '.cal-meeting-side__names' }).closest('details')!;
    expect(people.open).toBe(false);
    // Joining happens from the meeting page, so the page's "join from this page" hint is not said here.
    expect(screen.queryByText(/Join from this page/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open meeting page' }));
    expect(onOpenPage).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cancel meeting' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    // Destructive last.
    expect(items).toEqual(['Reschedule', 'Cancel meeting']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel meeting' }));
    expect(cancel).toHaveBeenCalled();

    rerender(<MeetingQuickView meeting={meeting} timezone="Africa/Lagos" now={now} roomOpen onJoin={onJoin} onOpenPage={onOpenPage} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join meeting' }));
    expect(onJoin).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });
});

describe('CancelMeetingDialog', () => {
  it('needs a real reason, sends it, and keeps the dialog open with the reason it failed', async () => {
    const onCancel = vi.fn().mockRejectedValueOnce(new Error('Too late to cancel.')).mockResolvedValueOnce(undefined);
    render(<CancelMeetingDialog title="Study permit review" otherParty="Maria Garcia" onCancel={onCancel} onClose={() => undefined} />);

    expect(screen.getByText(/Maria Garcia will be told/)).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Cancel meeting' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: /Reason/ }), { target: { value: '  Client is ill  ' } });
    await act(async () => fireEvent.click(confirm));
    expect(onCancel).toHaveBeenCalledWith('Client is ill');
    expect(screen.getByRole('alert').textContent).toBe('Too late to cancel.');
  });
});

describe('RescheduleDialog', () => {
  const slots: Slot[] = [
    { start_utc: '2026-10-12T13:00:00Z', end_utc: '2026-10-12T13:30:00Z', host_ids: [] },
    { start_utc: '2026-10-12T14:00:00Z', end_utc: '2026-10-12T14:30:00Z', host_ids: [] },
    { start_utc: '2026-10-12T15:00:00Z', end_utc: '2026-10-12T15:30:00Z', host_ids: [] },
  ];

  it('asks for one day on the viewer clock, offers only open times other than the current one, and sends the instant', async () => {
    const fetcher = vi.fn().mockResolvedValue({ slots });
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    render(<RescheduleDialog title="Study permit review" currentStart="2026-10-12T14:00:00Z" viewerZone="Africa/Lagos" fetcher={fetcher} bookingType="consultation" now={now} onReschedule={onReschedule} onClose={() => undefined} />);

    // Monday 12 October in Lagos (UTC+1): midnight to midnight, as instants.
    expect(fetcher).toHaveBeenCalledWith('consultation', '2026-10-11T23:00:00.000Z', '2026-10-12T23:00:00.000Z');
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Monday 12 October/ })).toHaveLength(2));
    expect(screen.queryByRole('button', { name: /Monday 12 October, 3:00 PM WAT/ })).toBeNull();

    expect((screen.getByRole('button', { name: 'Pick a new time' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Monday 12 October, 4:00 PM WAT/ }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Move to 4:00 PM WAT' })));
    expect(onReschedule).toHaveBeenCalledWith(slots[2], '');
  });

  it('cannot go back before today, and says so when a day has nothing open', async () => {
    const fetcher = vi.fn().mockResolvedValue({ slots: [] });
    render(<RescheduleDialog title="Call" currentStart="2026-10-01T14:00:00Z" viewerZone="UTC" fetcher={fetcher} bookingType="x" now={now} onReschedule={vi.fn()} onClose={() => undefined} />);

    // The meeting's own day is past, so the dialog starts today.
    expect(fetcher).toHaveBeenCalledWith('x', '2026-10-10T00:00:00.000Z', '2026-10-11T00:00:00.000Z');
    expect((screen.getByRole('button', { name: 'Previous day' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText('No open times on this day. Try another day.')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(fetcher).toHaveBeenLastCalledWith('x', '2026-10-11T00:00:00.000Z', '2026-10-12T00:00:00.000Z');
    await waitFor(() => expect(screen.getByText('No open times on this day. Try another day.')).toBeTruthy());
  });
});
