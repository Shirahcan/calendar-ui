import { describe, expect, it } from 'vitest';
import { dayKey, eventsToItems, gridDays, minutesIntoDay, slotsByDay } from '../src/time';

describe('time helpers (the test process runs in Pacific/Kiritimati, UTC+14)', () => {
  it('reads the day in the zone asked for, never the machine zone', () => {
    // 03:00Z on the 12th is still the 11th in Toronto and already the 12th in Lagos.
    expect(dayKey('2026-10-12T03:00:00Z', 'America/Toronto')).toBe('2026-10-11');
    expect(dayKey('2026-10-12T03:00:00Z', 'Africa/Lagos')).toBe('2026-10-12');
  });

  it('builds a Monday-first week and a whole-weeks month', () => {
    const week = gridDays('week', new Date('2026-10-14T15:00:00Z'), 'America/Toronto', 1);
    expect(week.map((d) => d.key)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);

    const month = gridDays('month', new Date('2026-10-14T15:00:00Z'), 'America/Toronto', 1);
    expect(month.length % 7).toBe(0);
    expect(month[0]!.key).toBe('2026-09-28');
    expect(month.filter((d) => d.inMonth)).toHaveLength(31);
  });

  it('gives the spring-forward day 23 hours', () => {
    const [d] = gridDays('day', new Date('2026-03-08T15:00:00Z'), 'America/Toronto');
    expect((d!.end.getTime() - d!.start.getTime()) / 3600000).toBe(23);
  });

  it('places an instant by its local minutes', () => {
    expect(minutesIntoDay('2026-10-12T13:30:00Z', 'America/Toronto')).toBe(9 * 60 + 30);
  });

  it('groups slots by the VIEWER day', () => {
    const byDay = slotsByDay([
      { start_utc: '2026-10-12T23:00:00Z', end_utc: '2026-10-13T00:00:00Z', host_ids: ['a'] },
      { start_utc: '2026-10-12T13:00:00Z', end_utc: '2026-10-12T14:00:00Z', host_ids: ['a'] },
    ], 'Africa/Lagos');

    // 23:00Z is 00:00 on the 13th in Lagos.
    expect([...byDay.keys()]).toEqual(['2026-10-12', '2026-10-13']);
  });

  it('keeps the privacy line: busy blocks carry no title', () => {
    const items = eventsToItems([
      { kind: 'busy', source: 'booking', start_utc: '2026-10-12T15:00:00Z', end_utc: '2026-10-12T16:00:00Z' },
      { kind: 'booking', booking: { id: 'b1', state: 'confirmed', start_utc: '2026-10-12T13:00:00Z', end_utc: '2026-10-12T14:00:00Z', hold_expires_at: null, hosts: ['a'], title: 'Consult' } },
    ]);

    expect(items.map((i) => [i.layer, i.title])).toEqual([['busy', 'Busy'], ['booking', 'Consult']]);
  });
});
