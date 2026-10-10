import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookingFlow } from '../src/components/BookingFlow';
import { MonthView } from '../src/components/MonthView';
import { SlotPicker } from '../src/components/SlotPicker';
import { WeekView } from '../src/components/WeekView';
import { gridDays, slotsByDay } from '../src/time';
import type { BookingFlow as Flow } from '../src/hooks/useBookingFlow';
import type { CalendarItem, Slot } from '../src/types';

const slots: Slot[] = [
  { start_utc: '2026-10-12T13:00:00Z', end_utc: '2026-10-12T14:00:00Z', host_ids: ['a'] },
  { start_utc: '2026-10-12T14:00:00Z', end_utc: '2026-10-12T15:00:00Z', host_ids: ['a'] },
];

describe('SlotPicker', () => {
  it('shows the viewer time and, when it differs, the host time in the label', () => {
    const onPick = vi.fn();
    render(<SlotPicker byDay={slotsByDay(slots, 'Africa/Lagos')} viewerZone="Africa/Lagos" hostZone="America/Toronto" onPick={onPick} />);

    const first = screen.getByRole('button', { name: /Monday 12 October, 2:00 PM WAT, 9:00 AM in Toronto/ });
    // The zone is named once above the compact buttons.
    expect(screen.getByText('Times in West Africa Standard Time')).toBeTruthy();
    fireEvent.click(first);
    expect(onPick).toHaveBeenCalledWith(slots[0]);
  });

  it('can drop its zone line and day heading for a single day the page already names', () => {
    const onPick = vi.fn();
    const day = new Map([...slotsByDay(slots, 'Africa/Lagos').entries()].slice(0, 1));
    const { container } = render(<SlotPicker byDay={day} viewerZone="Africa/Lagos" showZone={false} showDayHeading={false} onPick={onPick} />);

    expect(screen.queryByText('Times in West Africa Standard Time')).toBeNull();
    expect(container.querySelector('.cal-slots__dayhead')).toBeNull();
    // Each button still names the day and the zone for a screen reader.
    fireEvent.click(screen.getAllByRole('button', { name: /Monday 12 October, 2:00 PM WAT/ })[0]!);
    expect(onPick).toHaveBeenCalledWith(slots[0]);
  });

  it('says so when nothing is open', () => {
    render(<SlotPicker byDay={new Map()} viewerZone="UTC" onPick={() => undefined} emptyLabel="Nothing this week." />);
    expect(screen.getByText('Nothing this week.')).toBeTruthy();
  });
});

describe('WeekView', () => {
  it('places an item by its local time and labels it fully', () => {
    const days = gridDays('week', new Date('2026-10-12T15:00:00Z'), 'America/Toronto');
    const items: CalendarItem[] = [{ id: 'b1', start: new Date('2026-10-12T14:00:00Z'), end: new Date('2026-10-12T15:00:00Z'), title: 'Consult', layer: 'booking' }];
    render(<WeekView days={days} items={items} zone="America/Toronto" startHour={8} endHour={18} />);

    const item = screen.getByRole('button', { name: /Consult, Monday 12 October, 10:00 to 11:00/ });
    // 10:00 is 2h into an 8:00-18:00 grid: 20% down, 10% tall.
    expect(item.style.top).toBe('20%');
    expect(item.style.height).toBe('10%');
  });
});

describe('MonthView', () => {
  it('collapses a busy day into "+N more"', () => {
    const days = gridDays('month', new Date('2026-10-12T15:00:00Z'), 'UTC');
    const items: CalendarItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `i${i}`, start: new Date(`2026-10-12T1${i}:00:00Z`), end: new Date(`2026-10-12T1${i}:30:00Z`), title: `Item ${i}`, layer: 'busy',
    }));
    const onSelectDay = vi.fn();
    render(<MonthView days={days} items={items} zone="UTC" maxPerDay={3} onSelectDay={onSelectDay} />);

    fireEvent.click(screen.getByRole('button', { name: '+2 more' }));
    expect(onSelectDay.mock.calls[0]![0].key).toBe('2026-10-12');
  });
});

describe('BookingFlow', () => {
  const base = { secondsLeft: null, pick: vi.fn(async () => undefined), confirm: vi.fn(async () => undefined), restart: vi.fn() };

  it('turns a service error code into words a person can act on', () => {
    const flow: Flow = { ...base, state: { step: 'error', slot: slots[0]!, error: new Error('x'), code: 'slot_unavailable' } };
    render(<BookingFlow flow={flow} byDay={slotsByDay(slots, 'UTC')} viewerZone="UTC" />);

    expect(screen.getByRole('alert').textContent).toBe('That time was just taken. Please pick another.');
  });

  it('shows the hold countdown and the real verb while held', () => {
    const booking = { id: 'b1', state: 'held' as const, start_utc: slots[0]!.start_utc, end_utc: slots[0]!.end_utc, hold_expires_at: '2099-01-01T00:00:00Z', hosts: ['a'] };
    const flow: Flow = { ...base, secondsLeft: 125, state: { step: 'held', slot: slots[0]!, booking } };
    render(<BookingFlow flow={flow} byDay={new Map()} viewerZone="UTC" confirmLabel="Pay and book" />);

    expect(screen.getByText('We are holding this time for 2:05.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay and book' }));
    expect(base.confirm).toHaveBeenCalled();
  });
});
