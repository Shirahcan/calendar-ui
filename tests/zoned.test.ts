import { describe, expect, it } from 'vitest';
import { formatZonedDate, formatZonedDateTime, formatZonedTime, formatZonedTimeRange, onDay, zoneLabel } from '../src/zoned';

describe('zoned formatting (the test process runs in Pacific/Kiritimati, UTC+14)', () => {
  // The reported booking: 19:25Z on Sep 28 is 8:25 PM on Sep 28 in Lagos.
  const booked = '2026-09-28T19:25:00Z';

  it('always names the clock it is on', () => {
    expect(formatZonedTime(booked, 'Africa/Lagos')).toBe('8:25 PM GMT+1');
    expect(formatZonedTime(booked, 'America/Toronto')).toBe('3:25 PM EDT');
    expect(zoneLabel('2026-12-01T12:00:00Z', 'America/Toronto')).toBe('EST');
  });

  it('reads the date on the zone calendar, never the machine one', () => {
    expect(formatZonedDate(booked, 'Africa/Lagos')).toBe('Monday, September 28, 2026');
    expect(formatZonedDateTime('2026-10-05T20:00:00Z', 'Asia/Manila')).toBe('Tue, Oct 6, 2026, 4:00 AM GMT+8');
  });

  it('labels a range once', () => {
    expect(formatZonedTimeRange(booked, '2026-09-28T19:55:00Z', 'Africa/Lagos')).toBe('8:25 PM - 8:55 PM GMT+1');
  });

  it('keeps only the items on the viewer day', () => {
    const slots = [{ at: booked }, { at: '2026-09-29T19:25:00Z' }];
    expect(onDay(slots, '2026-09-29', 'Africa/Lagos', (s) => s.at)).toEqual([slots[1]]);
  });
});
