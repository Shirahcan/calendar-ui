import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MonthView } from '../src/components/MonthView';
import { SlotPicker } from '../src/components/SlotPicker';
import { WeekView } from '../src/components/WeekView';
import { CalendarUiProvider, themeStyle } from '../src/theme';
import { gridDays, slotsByDay } from '../src/time';
import type { CalendarItem, Slot } from '../src/types';

const slots: Slot[] = [{ start_utc: '2026-10-12T18:30:00Z', end_utc: '2026-10-12T19:30:00Z', host_ids: ['a'] }];

describe('CalendarUiProvider', () => {
  it('puts the theme on one wrapper as CSS variables and names the scheme it resolved', () => {
    const { container } = render(
      <CalendarUiProvider theme={{ accent: '#6f6df3', radius: '4px' }} darkTheme={{ surface: '#000' }} colorScheme="dark">
        <SlotPicker byDay={new Map()} viewerZone="UTC" onPick={() => undefined} />
      </CalendarUiProvider>,
    );
    const root = container.querySelector('.cal-root') as HTMLElement;

    expect(root.dataset.calScheme).toBe('dark');
    expect(root.style.getPropertyValue('--cal-accent')).toBe('#6f6df3');
    expect(root.style.getPropertyValue('--cal-radius')).toBe('4px');
    expect(root.style.getPropertyValue('--cal-surface')).toBe('#000');
  });

  it('keeps the dark tokens out of a light scheme', () => {
    const { container } = render(
      <CalendarUiProvider theme={{ accent: '#111' }} darkTheme={{ surface: '#000' }} colorScheme="light">
        <span />
      </CalendarUiProvider>,
    );
    const root = container.querySelector('.cal-root') as HTMLElement;

    expect(root.dataset.calScheme).toBe('light');
    expect(root.style.getPropertyValue('--cal-surface')).toBe('');
  });

  it('lets a product word every sentence, add its own classes and use a 12-hour clock', () => {
    render(
      <CalendarUiProvider hourCycle={12} labels={{ timesIn: (z) => `Heures: ${z}`, noTimes: 'Rien.' }} classNames={{ slot: 'rounded-md px-3', slotSelected: 'ring-2' }}>
        <SlotPicker byDay={slotsByDay(slots, 'America/Toronto')} viewerZone="America/Toronto" onPick={() => undefined} selected={slots[0]!.start_utc} />
      </CalendarUiProvider>,
    );

    expect(screen.getByText(/^Heures: /)).toBeTruthy();
    const button = screen.getByRole('button', { pressed: true });
    expect(button.className).toContain('cal-slot');
    expect(button.className).toContain('rounded-md px-3');
    expect(button.className).toContain('ring-2');
    expect(button.textContent).toBe('2:30 PM');
  });

  it('uses a product label for an empty picker unless the call passes its own', () => {
    render(
      <CalendarUiProvider labels={{ noTimes: 'Nothing open.' }}>
        <SlotPicker byDay={new Map()} viewerZone="UTC" onPick={() => undefined} />
      </CalendarUiProvider>,
    );
    expect(screen.getByText('Nothing open.')).toBeTruthy();
  });

  it('draws a slot or a month item entirely the product way through render props', () => {
    const days = gridDays('month', new Date('2026-10-12T15:00:00Z'), 'America/Toronto');
    const items: CalendarItem[] = [{ id: 'i', start: new Date('2026-10-12T14:00:00Z'), end: new Date('2026-10-12T15:00:00Z'), title: 'Consult', layer: 'booking' }];
    render(
      <>
        <SlotPicker byDay={slotsByDay(slots, 'UTC')} viewerZone="UTC" onPick={() => undefined} renderSlot={(_s, info) => <b>at {info.time}</b>} />
        <MonthView days={days} items={items} zone="America/Toronto" renderItem={(it) => <i>{it.title.toUpperCase()}</i>} />
      </>,
    );

    expect(screen.getByText('at 18:30')).toBeTruthy();
    expect(screen.getByText('CONSULT')).toBeTruthy();
  });

  it('labels the week grid hours on the chosen clock', () => {
    const days = gridDays('week', new Date('2026-10-12T15:00:00Z'), 'UTC');
    const { container } = render(
      <CalendarUiProvider hourCycle={12} labels={{ weekOf: (d) => `Semaine du ${d}` }}>
        <WeekView days={days} items={[]} zone="UTC" startHour={11} endHour={13} />
      </CalendarUiProvider>,
    );

    expect([...container.querySelectorAll('.cal-week__hour')].map((n) => n.textContent)).toEqual(['11 AM', '12 PM']);
    expect(screen.getByRole('grid', { name: /^Semaine du / })).toBeTruthy();
  });

  it('turns tokens into CSS variables and drops unknown or empty ones', () => {
    expect(themeStyle({ hourHeight: '60px', ink: '' })).toEqual({ '--cal-hour-height': '60px' });
  });
});
