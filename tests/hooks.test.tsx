import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reduceSpec, specProblems } from '../src/hooks/useAvailabilityEditor';
import { useBookingFlow } from '../src/hooks/useBookingFlow';
import { useSlots } from '../src/hooks/useSlots';
import type { AvailabilitySpec, Booking, Slot } from '../src/types';

const slot: Slot = { start_utc: '2026-10-12T13:00:00Z', end_utc: '2026-10-12T14:00:00Z', host_ids: ['a'] };
const held: Booking = { id: 'b1', state: 'held', start_utc: slot.start_utc, end_utc: slot.end_utc, hold_expires_at: new Date(Date.now() + 600_000).toISOString(), hosts: ['a'] };

describe('useSlots', () => {
  it('loads, groups by viewer day, and ignores a late answer for an old range', async () => {
    let resolveOld: (v: { slots: Slot[] }) => void = () => undefined;
    const fetcher = vi.fn((_type: string, from: string) => from.startsWith('2026-10-05')
      ? new Promise<{ slots: Slot[] }>((r) => { resolveOld = r; })
      : Promise.resolve({ slots: [slot], stale_external: true }));

    const { result, rerender } = renderHook((p: { from: Date }) => useSlots({ fetcher, bookingType: 't', from: p.from, to: new Date('2026-10-19T00:00:00Z'), viewerZone: 'America/Toronto' }),
      { initialProps: { from: new Date('2026-10-05T00:00:00Z') } });

    expect(result.current.loading).toBe(true);
    rerender({ from: new Date('2026-10-12T00:00:00Z') });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => resolveOld({ slots: [] }));   // the stale range answers last
    expect(result.current.slots).toEqual([slot]);
    expect(result.current.staleExternal).toBe(true);
    expect([...result.current.byDay.keys()]).toEqual(['2026-10-12']);
  });

  it('does not refetch just because the product passed a new fetcher closure', async () => {
    const calls: string[] = [];
    const props = { bookingType: 't', from: new Date('2026-10-12T00:00:00Z'), to: new Date('2026-10-13T00:00:00Z'), viewerZone: 'UTC' };
    const { rerender } = renderHook(() => useSlots({ ...props, fetcher: async (t) => { calls.push(t); return { slots: [] }; } }));

    await waitFor(() => expect(calls).toHaveLength(1));
    rerender();
    rerender();
    expect(calls).toHaveLength(1);
  });
});

describe('useBookingFlow', () => {
  it('holds, counts down, confirms', async () => {
    const hold = vi.fn(async (_slot: Slot, _key: string) => held);
    const confirm = vi.fn(async () => ({ ...held, state: 'confirmed' as const, hold_expires_at: null }));
    const { result } = renderHook(() => useBookingFlow({ hold, confirm }));

    await act(() => result.current.pick(slot));
    expect(result.current.state.step).toBe('held');
    expect(result.current.secondsLeft).toBeGreaterThan(590);
    expect(hold.mock.calls[0]![1]).toMatch(/^[0-9a-f-]{36}$/);   // an idempotency key per attempt

    await act(() => result.current.confirm());
    expect(result.current.state.step).toBe('done');
  });

  it('surfaces the service error code so the product can say the right thing', async () => {
    const { result } = renderHook(() => useBookingFlow({
      hold: async () => { throw Object.assign(new Error('taken'), { errors: { code: 'slot_unavailable' } }); },
      confirm: async () => held,
    }));

    await act(() => result.current.pick(slot));
    expect(result.current.state).toMatchObject({ step: 'error', code: 'slot_unavailable' });
  });

  it('releases a live hold when the person goes back', async () => {
    const release = vi.fn(async () => undefined);
    const { result } = renderHook(() => useBookingFlow({ hold: async () => held, confirm: async () => held, release }));

    await act(() => result.current.pick(slot));
    act(() => result.current.restart());
    expect(release).toHaveBeenCalledWith('b1');
    expect(result.current.state.step).toBe('pick');
  });
});

describe('availability editor', () => {
  const base: AvailabilitySpec = { schema: 1, timezone: { zone: 'America/Toronto' } };

  it('edits every layer and keeps dated rows one per date', () => {
    let spec = reduceSpec(base, { type: 'addWeekly', rule: { days: ['mon'], start: '09:00', end: '17:00' } });
    spec = reduceSpec(spec, { type: 'setOverride', date: '2026-10-13', windows: [['10:00', '14:00']] });
    spec = reduceSpec(spec, { type: 'setOverride', date: '2026-10-13', windows: [] });
    spec = reduceSpec(spec, { type: 'setHolidays', region: 'CA-ON' });

    expect(spec.overrides).toEqual([{ date: '2026-10-13', windows: [] }]);
    expect(spec.holidays).toEqual({ region: 'CA-ON', observe: true });
    expect(reduceSpec(spec, { type: 'setHolidays', region: null }).holidays).toBeUndefined();
  });

  it('flags what the service would refuse, without false-flagging an overnight window', () => {
    expect(specProblems({ ...base, weekly: [{ days: [], start: '09:00', end: '09:00' }] })).toHaveLength(2);
    expect(specProblems({ ...base, dates: [{ date: '2026-10-08', windows: [['22:00', '02:00'], ['01:00', '03:00']] }] })).toHaveLength(0);
    expect(specProblems({ ...base, dates: [{ date: '2026-10-08', windows: [['09:00', '12:00'], ['11:00', '13:00']] }] })).toEqual(['2026-10-08: two windows overlap.']);
  });
});

describe('useDisplayTimezone', () => {
  it('reads the device zone, follows a pick on this browser, and clears back to the device', async () => {
    const { useDisplayTimezone, setDisplayTimezone, deviceTimezone } = await import('../src/hooks/useDisplayTimezone');
    const { result } = renderHook(() => useDisplayTimezone());

    expect(result.current.timezone).toBe(deviceTimezone());
    expect(result.current.isPicked).toBe(false);

    act(() => setDisplayTimezone('Africa/Lagos'));
    expect(result.current.timezone).toBe('Africa/Lagos');
    expect(result.current.isPicked).toBe(true);

    act(() => setDisplayTimezone(deviceTimezone()));
    expect(result.current.timezone).toBe(deviceTimezone());
    expect(result.current.isPicked).toBe(false);
  });
});
