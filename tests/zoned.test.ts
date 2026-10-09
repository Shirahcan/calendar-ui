import { describe, expect, it } from 'vitest';
import { formatZonedDate, formatZonedDateTime, formatZonedTime, formatZonedTimeRange, onDay, zoneLabel } from '../src/zoned';

describe('zoned formatting (the test process runs in Pacific/Kiritimati, UTC+14)', () => {
  // The reported booking: 19:25Z on Sep 28 is 8:25 PM on Sep 28 in Lagos.
  const booked = '2026-09-28T19:25:00Z';

  it('always NAMES the clock it is on', () => {
    expect(formatZonedTime(booked, 'Africa/Lagos')).toBe('8:25 PM WAT');
    expect(formatZonedTime(booked, 'America/Toronto')).toBe('3:25 PM EDT');
    expect(zoneLabel('2026-12-01T12:00:00Z', 'America/Toronto')).toBe('EST');
    // A short name (owner 2026-10-09), never a bare offset where one is known.
    expect(zoneLabel(booked, 'Asia/Manila')).toBe('PHT');
    expect(zoneLabel(booked, 'Africa/Accra')).toBe('GMT');
    expect(zoneLabel(booked, 'Asia/Kolkata')).toBe('IST');
    // Summer time where the zone keeps it.
    expect(zoneLabel('2026-07-01T12:00:00Z', 'Europe/London')).toBe('BST');
    expect(zoneLabel('2026-12-01T12:00:00Z', 'Europe/London')).toBe('GMT');
    expect(zoneLabel('2026-07-01T12:00:00Z', 'Europe/Paris')).toBe('CEST');
    expect(zoneLabel('2026-12-01T12:00:00Z', 'Europe/Paris')).toBe('CET');
    expect(zoneLabel('2026-01-15T12:00:00Z', 'Australia/Sydney')).toBe('AEDT');
    expect(zoneLabel('2026-07-15T12:00:00Z', 'Australia/Sydney')).toBe('AEST');
    // A zone nobody has named keeps the offset rather than inventing letters.
    expect(zoneLabel(booked, 'Indian/Chagos')).toMatch(/^GMT\+/);
  });

  it('reads the date on the zone calendar, never the machine one', () => {
    expect(formatZonedDate(booked, 'Africa/Lagos')).toBe('Monday, September 28, 2026');
    expect(formatZonedDateTime('2026-10-05T20:00:00Z', 'Asia/Manila')).toBe('Tue, Oct 6, 2026, 4:00 AM PHT');
  });

  it('labels a range once', () => {
    expect(formatZonedTimeRange(booked, '2026-09-28T19:55:00Z', 'Africa/Lagos')).toBe('8:25 PM - 8:55 PM WAT');
  });

  it('keeps only the items on the viewer day', () => {
    const slots = [{ at: booked }, { at: '2026-09-29T19:25:00Z' }];
    expect(onDay(slots, '2026-09-29', 'Africa/Lagos', (s) => s.at)).toEqual([slots[1]]);
  });
});

describe('wall times and clocks', () => {
  it('reads a typed wall time on the named zone, not the machine one', async () => {
    const { wallTimeToInstant, instantToWallTime } = await import('../src/zoned');
    expect(wallTimeToInstant('2026-10-07T20:25', 'Africa/Lagos')).toBe('2026-10-07T19:25:00.000Z');
    expect(wallTimeToInstant('2026-10-07T15:25', 'America/Toronto')).toBe('2026-10-07T19:25:00.000Z');
    expect(wallTimeToInstant('not a time', 'Africa/Lagos')).toBeNull();
    expect(instantToWallTime('2026-10-07T19:25:00Z', 'Asia/Manila')).toBe('2026-10-08T03:25');
  });

  it('knows which zones read the same clock in both DST seasons', async () => {
    const { sameClock, zoneCity } = await import('../src/zoned');
    const oct = Date.parse('2026-10-04T12:00:00Z');
    expect(sameClock('America/Toronto', 'America/New_York', oct)).toBe(true);
    expect(sameClock('America/Toronto', 'Africa/Lagos', oct)).toBe(false);
    // Same offset today, different in winter: London (BST, +1) vs Lagos (+1 all year).
    expect(sameClock('Europe/London', 'Africa/Lagos', Date.parse('2026-07-01T12:00:00Z'))).toBe(false);
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });
});
