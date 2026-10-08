import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvailabilityEditor } from '../src/components/AvailabilityEditor';
import { dayGap, dayWindows, reduceSpec } from '../src/hooks/useAvailabilityEditor';
import type { AvailabilitySpec, SchedulingPolicy } from '../src/types';

const POLICY: SchedulingPolicy = {
  min_buffer_minutes: 5,
  max_buffer_minutes: 120,
  default_buffer_minutes: 10,
  buffer_choices: [5, 10, 15, 30],
  min_notice_minutes: 60,
  horizon_days: 365,
  hold_seconds: 300,
  seed_weekly: [{ days: ['mon', 'tue', 'wed', 'thu'], start: '08:30', end: '16:30' }, { days: ['fri'], start: '09:00', end: '13:00' }],
  observe_holidays_by_default: true,
};

const BASE: AvailabilitySpec = {
  schema: 1,
  timezone: { zone: 'America/Toronto' },
  weekly: [
    { days: ['mon', 'tue'], start: '09:00', end: '12:00', gap: 15 },
    { days: ['mon'], start: '13:00', end: '17:00', gap: 15 },
    { days: ['wed'], start: '10:00', end: '11:00', valid_from: '2026-11-01' },
  ],
  holidays: { region: 'CA-ON', observe: true, work: ['2026-10-12'] },
};

describe('the availability reducer', () => {
  it('rewrites one weekday and keeps its gap, the other days of a shared rule, and dated rules', () => {
    const spec = reduceSpec(BASE, { type: 'setDayWindows', day: 'mon', windows: [['08:00', '10:00']] });

    expect(dayWindows(spec, 'mon')).toEqual([['08:00', '10:00']]);
    expect(dayWindows(spec, 'tue')).toEqual([['09:00', '12:00']]);
    expect(spec.weekly?.find((r) => r.days.includes('mon'))?.gap).toBe(15);
    expect(spec.weekly?.some((r) => r.valid_from === '2026-11-01')).toBe(true);
  });

  it('keeps holiday work days within the same region, and the place when holidays are turned off', () => {
    let spec = reduceSpec(BASE, { type: 'setHolidayWork', date: '2026-12-25', working: true });
    expect(spec.holidays?.work).toEqual(['2026-10-12', '2026-12-25']);
    expect(reduceSpec(spec, { type: 'setHolidays', region: 'CA-ON' }).holidays?.work).toEqual(['2026-10-12', '2026-12-25']);
    expect(reduceSpec(spec, { type: 'setHolidays', region: 'NG' }).holidays?.work).toBeUndefined();
    expect(reduceSpec(spec, { type: 'setHolidays', region: null }).holidays).toEqual({ region: 'CA-ON', observe: false, work: ['2026-10-12', '2026-12-25'] });
  });

  it("sets the schedule buffer, and one day's own break without touching the days it shared a rule with", () => {
    let spec = reduceSpec(BASE, { type: 'setBuffer', minutes: 20 });
    expect(spec.buffer).toBe(20);
    expect(reduceSpec(spec, { type: 'setBuffer', minutes: null }).buffer).toBeUndefined();

    spec = reduceSpec(spec, { type: 'setDayGap', day: 'tue', minutes: 30 });
    expect(dayGap(spec, 'tue')).toBe(30);
    expect(dayGap(spec, 'mon')).toBe(15);
    expect(dayWindows(spec, 'mon')).toEqual([['09:00', '12:00'], ['13:00', '17:00']]);

    spec = reduceSpec(spec, { type: 'setDayGap', day: 'mon', minutes: null });
    expect(dayGap(spec, 'mon')).toBeUndefined();
    expect(spec.weekly?.some((r) => r.valid_from === '2026-11-01')).toBe(true);
  });
});

function adapter(initial: AvailabilitySpec, regions = [{ code: 'CA-ON', name: 'Ontario' }]) {
  let held = initial;
  return {
    load: vi.fn(async () => ({ spec: held, policy: POLICY, regions })),
    save: vi.fn(async (s: AvailabilitySpec) => {
      held = s;
      return s;
    }),
    holidays: vi.fn(async () => [{ date: '2026-10-12', name: 'Thanksgiving' }, { date: '2026-12-25', name: 'Christmas Day' }]),
  };
}

describe('AvailabilityEditor', () => {
  it('shows the week, edits a day, and saves the whole spec', async () => {
    const a = adapter(BASE);
    render(<AvailabilityEditor adapter={a} />);

    await screen.findByLabelText('Your week at a glance');
    expect(screen.getByText('Times are on America/Toronto time.', { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Take meetings on Friday'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalledTimes(1));
    // A day turned on gets the product's seed hours for that day, not a time written in the component.
    expect(dayWindows(a.save.mock.calls[0]![0], 'fri')).toEqual([['09:00', '13:00']]);
    await screen.findByText('Saved');
  });

  it('discards edits back to what the service holds', async () => {
    render(<AvailabilityEditor adapter={adapter(BASE)} />);
    await screen.findByLabelText('Your week at a glance');

    fireEvent.click(screen.getByRole('button', { name: 'Remove 09:00 to 12:00 on Tuesday' }));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('lets a person choose which public holidays to work', async () => {
    const a = adapter(BASE);
    render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('Your week at a glance');

    fireEvent.click(screen.getByRole('tab', { name: 'Public holidays' }));
    const christmas = (await screen.findByText('Christmas Day')).closest('li')!;
    fireEvent.click(within(christmas).getByLabelText('Working this day'));
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));

    await waitFor(() => expect(a.save.mock.calls[0]![0].holidays?.work).toEqual(['2026-10-12', '2026-12-25']));
  });

  it('adds a closed date and time off', async () => {
    const a = adapter(BASE);
    render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('Your week at a glance');

    fireEvent.click(screen.getByRole('tab', { name: 'Date changes' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-03' } });
    fireEvent.click(screen.getByLabelText('Closed all day'));
    fireEvent.click(screen.getByRole('button', { name: 'Add change' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Time off' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-12-24' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-12-26' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add time off' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    const saved = a.save.mock.calls[0]![0];
    expect(saved.overrides).toEqual([{ date: '2026-11-03', windows: [] }]);
    expect(saved.blocks).toEqual([{ from: '2026-12-24', to: '2026-12-26' }]);
  });

  it("saves the usual buffer and a day's own break from the product's choices, with no copy buttons", async () => {
    const a = adapter(BASE);
    render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('Your week at a glance');

    expect(screen.queryByText('Copy to weekdays')).toBeNull();
    const usual = screen.getByLabelText('Time kept free around each meeting', { exact: false }) as HTMLSelectElement;
    expect(usual.value).toBe('10');
    expect(Array.from(usual.options).map((o) => o.value)).toEqual(['5', '10', '15', '30']);
    fireEvent.change(usual, { target: { value: '15' } });

    const tuesday = screen.getByLabelText('Break around meetings on Tuesday') as HTMLSelectElement;
    expect(tuesday.value).toBe('15');
    fireEvent.change(tuesday, { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    const saved = a.save.mock.calls[0]![0];
    expect(saved.buffer).toBe(15);
    expect(dayGap(saved, 'tue')).toBe(30);
    expect(dayGap(saved, 'mon')).toBe(15);
  });

  it('never shows "no holidays" for a list it could not read', async () => {
    const a = { ...adapter(BASE), holidays: vi.fn(async () => { throw new Error('down'); }) };
    render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('Your week at a glance');

    fireEvent.click(screen.getByRole('tab', { name: 'Public holidays' }));
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    expect(screen.queryByText('No public holidays', { exact: false })).toBeNull();
  });

  it('says why it could not load', async () => {
    render(<AvailabilityEditor adapter={{ load: async () => { throw new Error('The calendar service is unreachable.'); }, save: vi.fn() }} />);
    expect((await screen.findByRole('alert')).textContent).toBe('The calendar service is unreachable.');
  });
});
