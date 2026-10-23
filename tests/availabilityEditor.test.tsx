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

  it('lets each window set its meeting length when the product asks, and keeps it through day edits', async () => {
    const withLengths = { ...BASE, weekly: [{ days: ['mon'], start: '09:00', end: '11:00', length: 60 }, { days: ['mon'], start: '14:00', end: '16:00' }] } as AvailabilitySpec;
    const a = adapter(withLengths);
    const policy = { ...POLICY, duration_choices: [30, 45, 60] };
    a.load = vi.fn(async () => ({ spec: withLengths, policy, regions: [] }));
    render(<AvailabilityEditor adapter={a} windowLengths />);
    await screen.findByLabelText('Your week at a glance');

    const morning = screen.getByLabelText('Meeting length from 09:00 to 11:00 on Monday') as HTMLSelectElement;
    expect(morning.value).toBe('60');
    expect(Array.from(morning.options).map((o) => o.value)).toEqual(['', '30', '45', '60']);
    const afternoon = screen.getByLabelText('Meeting length from 14:00 to 16:00 on Monday') as HTMLSelectElement;
    expect(afternoon.value).toBe('');
    fireEvent.change(afternoon, { target: { value: '45' } });
    fireEvent.change(screen.getAllByLabelText('Monday From')[0] as HTMLInputElement, { target: { value: '08:30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    expect(dayWindows(a.save.mock.calls[0]![0], 'mon')).toEqual([['08:30', '11:00', 60], ['14:00', '16:00', 45]]);
  });

  it('says what the usual length is when the product tells it', async () => {
    const policy = { ...POLICY, duration_choices: [30, 60] };
    const a = adapter(BASE);
    a.load = vi.fn(async () => ({ spec: BASE, policy, regions: [] }));
    render(<AvailabilityEditor adapter={a} windowLengths usualLength={60} />);
    await screen.findByLabelText('Your week at a glance');

    const select = screen.getByLabelText('Meeting length from 09:00 to 12:00 on Monday') as HTMLSelectElement;
    expect(select.options[0]!.textContent).toBe(`Usual length (${select.options[2]!.textContent})`);
  });

  it('offers no window length unless the product asks for it', async () => {
    render(<AvailabilityEditor adapter={adapter(BASE)} />);
    await screen.findByLabelText('Your week at a glance');

    expect(screen.queryByLabelText('Meeting length from 09:00 to 12:00 on Monday')).toBeNull();
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

describe('Hours for a set time', () => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };

  const SEASONAL: AvailabilitySpec = {
    schema: 1,
    timezone: { zone: 'America/Edmonton' },
    weekly: [
      { days: ['wed'], start: '09:00', end: '12:00' },
      { days: ['mon', 'fri'], start: '09:00', end: '17:00', valid_until: '2099-09-16', length: 30 },
      { days: ['tue'], start: '10:00', end: '11:00', valid_until: '2000-01-31' },
    ],
    periods: [{ from: '2099-12-01', to: '2099-12-20', weekly: [{ days: ['sat'], start: '10:00', end: '14:00' }] }],
    dates: [{ date: '2099-11-03', windows: [['18:00', '20:00']] }],
  };

  it('shows every weekly rule with dates and every season, and removes one', async () => {
    const a = adapter(SEASONAL);
    render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('Your week at a glance');

    // The every-week pattern leaves them out, so this list is the only place they are seen.
    expect(screen.getByText('Monday, Friday: 09:00 to 17:00, 30 min meetings')).toBeTruthy();
    expect(screen.getByText('Saturday: 10:00 to 14:00')).toBeTruthy();
    expect(screen.getByText('Tuesday: 10:00 to 11:00 (ended)')).toBeTruthy();

    const row = screen.getByText('Monday, Friday: 09:00 to 17:00, 30 min meetings').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    const saved = a.save.mock.calls[0]![0] as AvailabilitySpec;
    expect(saved.weekly).toEqual([SEASONAL.weekly![0], SEASONAL.weekly![2]]);
    expect(saved.periods).toEqual(SEASONAL.periods);
  });

  it('adds hours that end on a date, and only once a date is picked', async () => {
    const a = adapter({ schema: 1, timezone: { zone: 'America/Edmonton' }, weekly: [] });
    const policy = { ...POLICY, duration_choices: [30, 60] };
    a.load = vi.fn(async () => ({ spec: { schema: 1 as const, timezone: { zone: 'America/Edmonton' }, weekly: [] }, policy, regions: [] }));
    render(<AvailabilityEditor adapter={a} windowLengths />);
    await screen.findByLabelText('Your week at a glance');

    // The form opens in a modal from the button under the list.
    fireEvent.click(screen.getByRole('button', { name: 'Add hours for a set time' }));
    const add = screen.getByRole('button', { name: 'Add these hours' }) as HTMLButtonElement;
    const season = add.closest('dialog') as HTMLElement;
    fireEvent.click(within(season).getByLabelText('Thursday'));
    expect(add.disabled).toBe(true);
    expect(screen.getByText('Pick a start date, an end date or both. Hours with neither belong in the week above.')).toBeTruthy();

    fireEvent.change(within(season).getByLabelText('Ends on'), { target: { value: '2099-03-31' } });
    fireEvent.change(within(season).getByLabelText('Meeting length', { exact: false }), { target: { value: '60' } });
    fireEvent.click(add);
    // Adding closes the modal.
    expect(screen.queryByRole('button', { name: 'Add these hours' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    expect((a.save.mock.calls[0]![0] as AvailabilitySpec).weekly).toEqual([
      { days: ['thu'], start: '08:30', end: '16:30', valid_until: '2099-03-31', length: 60 },
    ]);
  });

  it('lists extra hours on a date beside the date changes', async () => {
    render(<AvailabilityEditor adapter={adapter(SEASONAL)} />);
    await screen.findByLabelText('Your week at a glance');
    fireEvent.click(screen.getByRole('tab', { name: 'Date changes' }));

    expect(screen.getByText('Extra hours: 18:00-20:00')).toBeTruthy();
  });
});

describe('Weekly hours only for a set period (policy weekly_hours_need_dates)', () => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };

  const DATED_POLICY: SchedulingPolicy = { ...POLICY, weekly_hours_need_dates: true };

  function datedAdapter(spec: AvailabilitySpec) {
    const a = adapter(spec);
    let held = spec;
    a.load = vi.fn(async () => ({ spec: held, policy: DATED_POLICY, regions: [] }));
    a.save = vi.fn(async (s: AvailabilitySpec) => {
      held = s;
      return s;
    });
    return a;
  }

  function ymd(plus: number): string {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + plus);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('hides the every-week pattern and adds a period with both dates, two weeks by default', async () => {
    const a = datedAdapter({ schema: 1, timezone: { zone: 'America/Edmonton' }, weekly: [] });
    render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('The next 7 days at a glance');

    expect(screen.queryByText('Hours for a set time')).toBeNull();
    expect(screen.getByText('Weekly hours for a set period')).toBeTruthy();
    expect(screen.getByText('No periods yet. Nobody can book time with you until you add one.')).toBeTruthy();
    // No day toggles of the every-week editor.
    expect(screen.queryByRole('checkbox', { name: 'Monday' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add a period' }));
    const add = screen.getByRole('button', { name: 'Add these hours' }) as HTMLButtonElement;
    const dialog = add.closest('dialog') as HTMLElement;
    expect((within(dialog).getByLabelText('Starts on') as HTMLInputElement).value).toBe(ymd(0));
    expect((within(dialog).getByLabelText('Ends on') as HTMLInputElement).value).toBe(ymd(13));

    fireEvent.click(within(dialog).getByLabelText('Tuesday'));
    fireEvent.change(within(dialog).getByLabelText('Ends on'), { target: { value: '' } });
    expect(add.disabled).toBe(true);
    expect(screen.getByText('Pick a start date and an end date.')).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('Ends on'), { target: { value: ymd(6) } });
    fireEvent.click(add);
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    expect((a.save.mock.calls[0]![0] as AvailabilitySpec).weekly).toEqual([
      { days: ['tue'], start: '08:30', end: '16:30', valid_from: ymd(0), valid_until: ymd(6) },
    ]);
  });

  it('lists an open-ended row as one to fix and blocks saving until it is gone', async () => {
    const a = datedAdapter({
      schema: 1,
      timezone: { zone: 'America/Edmonton' },
      weekly: [
        { days: ['wed'], start: '09:00', end: '12:00' },
        { days: ['thu'], start: '09:00', end: '12:00', valid_from: ymd(0), valid_until: ymd(13) },
      ],
    });
    render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('The next 7 days at a glance');

    const open = screen.getByText('Wednesday: 09:00 to 12:00 (no end date: remove it and add it again with dates)').closest('li')!;
    expect(screen.getByText('Some weekly hours have no start or end date. Remove them, or add them again with dates, before saving.')).toBeTruthy();

    fireEvent.click(within(open).getByRole('button', { name: 'Remove' }));
    const save = screen.getByRole('button', { name: 'Save availability' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    expect((a.save.mock.calls[0]![0] as AvailabilitySpec).weekly).toHaveLength(1);
  });

  it('lists hours over the same dates as one period, removable line by line or all at once', async () => {
    const shared = { valid_from: ymd(0), valid_until: ymd(27) };
    const spec: AvailabilitySpec = {
      schema: 1,
      timezone: { zone: 'America/Edmonton' },
      weekly: [
        { days: ['wed'], start: '13:00', end: '15:00', ...shared },
        { days: ['thu'], start: '10:00', end: '12:00', valid_from: ymd(0), valid_until: ymd(6) },
        { days: ['mon'], start: '09:00', end: '17:00', ...shared },
      ],
    };

    // One line removed: the other rule of that period, and the other period, stay.
    const a = datedAdapter(spec);
    const { unmount } = render(<AvailabilityEditor adapter={a} />);
    await screen.findByLabelText('The next 7 days at a glance');
    const period = screen.getByText('Monday: 09:00 to 17:00').closest('li')!;
    expect(within(period).getByText('Wednesday: 13:00 to 15:00')).toBeTruthy();
    // In the week's order, not the stored one (Wednesday is stored first).
    expect(within(period).getAllByText(/: \d\d:\d\d to /).map((n) => n.textContent?.split(':')[0])).toEqual(['Monday', 'Wednesday']);
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('cal-avail__item'))).toHaveLength(2);
    fireEvent.click(within(period).getByRole('button', { name: 'Remove Wednesday: 13:00 to 15:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(a.save).toHaveBeenCalled());
    expect((a.save.mock.calls[0]![0] as AvailabilitySpec).weekly).toEqual([spec.weekly![1], spec.weekly![2]]);
    unmount();

    // "Remove all" takes the whole period (both rules, whatever their order), and only it.
    const b = datedAdapter(spec);
    render(<AvailabilityEditor adapter={b} />);
    await screen.findByLabelText('The next 7 days at a glance');
    const again = screen.getByText('Monday: 09:00 to 17:00').closest('li')!;
    fireEvent.click(within(again).getByRole('button', { name: 'Remove all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await waitFor(() => expect(b.save).toHaveBeenCalled());
    expect((b.save.mock.calls[0]![0] as AvailabilitySpec).weekly).toEqual([spec.weekly![1]]);
  });

  it("shows the next seven days' hours from the periods that cover each date", async () => {
    const today = new Date();
    const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const day = names[today.getDay()]!;
    render(<AvailabilityEditor adapter={datedAdapter({
      schema: 1,
      timezone: { zone: 'America/Edmonton' },
      weekly: [{ days: [day], start: '10:00', end: '11:30', valid_from: ymd(0), valid_until: ymd(0) }],
    })} />);
    const ribbon = await screen.findByLabelText('The next 7 days at a glance');

    expect(within(ribbon).getByText('10:00-11:30')).toBeTruthy();
  });
});
