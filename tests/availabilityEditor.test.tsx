import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvailabilityEditor } from '../src/components/AvailabilityEditor';
import { dayWindows, reduceSpec } from '../src/hooks/useAvailabilityEditor';
import type { AvailabilitySpec } from '../src/types';

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

  it('copies a day to others and keeps holiday work days only within the same region', () => {
    let spec = reduceSpec(BASE, { type: 'copyDay', day: 'mon', to: ['thu', 'fri'] });
    expect(dayWindows(spec, 'fri')).toEqual([['09:00', '12:00'], ['13:00', '17:00']]);

    spec = reduceSpec(spec, { type: 'setHolidayWork', date: '2026-12-25', working: true });
    expect(spec.holidays?.work).toEqual(['2026-10-12', '2026-12-25']);
    expect(reduceSpec(spec, { type: 'setHolidays', region: 'CA-ON' }).holidays?.work).toEqual(['2026-10-12', '2026-12-25']);
    expect(reduceSpec(spec, { type: 'setHolidays', region: 'NG' }).holidays?.work).toBeUndefined();
  });
});

function adapter(initial: AvailabilitySpec) {
  let held = initial;
  return {
    load: vi.fn(async () => held),
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
    expect(dayWindows(a.save.mock.calls[0]![0], 'fri')).toEqual([['09:00', '17:00']]);
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
    render(<AvailabilityEditor adapter={a} regions={[{ code: 'CA-ON', label: 'Ontario' }]} />);
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

  it('says why it could not load', async () => {
    render(<AvailabilityEditor adapter={{ load: async () => { throw new Error('The calendar service is unreachable.'); }, save: vi.fn() }} />);
    expect((await screen.findByRole('alert')).textContent).toBe('The calendar service is unreachable.');
  });
});
