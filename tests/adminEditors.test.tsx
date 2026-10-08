import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarConnectionsPanel, type CalendarConnection } from '../src/components/CalendarConnectionsPanel';
import { HolidayRulesEditor, type HolidayRule, type HolidayRuleInput } from '../src/components/HolidayRulesEditor';
import { SchedulingPolicyEditor, type SchedulingPolicyState } from '../src/components/SchedulingPolicyEditor';
import type { SchedulingPolicy } from '../src/types';

const DEFAULTS: SchedulingPolicy = {
  min_buffer_minutes: 0,
  max_buffer_minutes: 240,
  default_buffer_minutes: 0,
  buffer_choices: [0, 5, 10],
  min_notice_minutes: 0,
  horizon_days: 60,
  hold_seconds: 900,
  seed_weekly: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00' }],
  observe_holidays_by_default: true,
};

describe('SchedulingPolicyEditor', () => {
  it('saves the whole policy, including the seed week, and resets to the standard rules', async () => {
    let state: SchedulingPolicyState = { policy: DEFAULTS, is_default: true, defaults: DEFAULTS };
    const save = vi.fn(async (p: SchedulingPolicy | null) => (state = { policy: p ?? DEFAULTS, is_default: p === null, defaults: DEFAULTS }));
    render(<SchedulingPolicyEditor adapter={{ load: async () => state, save }} />);

    fireEvent.change(await screen.findByLabelText('Smallest allowed (minutes)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Usual (minutes)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Least notice (minutes)'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Hold a picked time for (minutes)'), { target: { value: '5' } });
    fireEvent.change(screen.getAllByLabelText('Add choice')[0]!, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add choice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove 0 minutes' }));
    fireEvent.click(screen.getByLabelText('Take meetings on Friday'));
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]![0]!;
    expect(sent).toMatchObject({ min_buffer_minutes: 5, default_buffer_minutes: 10, min_notice_minutes: 60, hold_seconds: 300, buffer_choices: [5, 10, 15] });
    expect(sent.seed_weekly.some((r) => r.days.includes('fri'))).toBe(false);
    expect(screen.queryByText('Break', { exact: true })).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'Use the standard rules' }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(null));
    await screen.findByText('Saved');
  });

  it('shows the service refusal', async () => {
    render(<SchedulingPolicyEditor adapter={{ load: async () => ({ policy: DEFAULTS, is_default: true }), save: async () => { throw new Error('The default buffer must sit between the minimum and the maximum.'); } }} />);
    fireEvent.change(await screen.findByLabelText('Usual (minutes)'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect((await screen.findByRole('alert')).textContent).toContain('must sit between');
  });
});

describe('HolidayRulesEditor', () => {
  function adapter() {
    let rules: HolidayRule[] = [{ id: 1, name: 'Canada Day', kind: 'fixed', params: { month: 7, day: 1 }, active: true, next: '2026-07-01' }];
    let next = 2;
    return {
      regions: vi.fn(async () => [{ code: 'CA', name: 'Canada' }]),
      putRegion: vi.fn(async (code: string, name: string) => [{ code: 'CA', name: 'Canada' }, { code, name }]),
      rules: vi.fn(async () => rules),
      save: vi.fn(async (_r: string, id: number | null, input: HolidayRuleInput) => {
        rules = id === null ? [...rules, { ...input, id: next++, next: null }] : rules.map((r) => (r.id === id ? { ...r, ...input } : r));
        return rules;
      }),
      remove: vi.fn(async (_r: string, id: number) => (rules = rules.filter((r) => r.id !== id))),
      preview: vi.fn(async () => [{ date: '2027-07-01', name: 'Canada Day' }]),
    };
  }

  it('lists a place, adds a rule in plain words, edits and removes one after asking', async () => {
    const a = adapter();
    const confirm = vi.fn(async () => true);
    render(<HolidayRulesEditor adapter={a} confirmRemove={confirm} />);

    expect(await screen.findByText('July 1')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Civic Holiday' } });
    fireEvent.change(screen.getByLabelText('Falls on'), { target: { value: 'nth_weekday' } });
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holiday' }));

    await waitFor(() => expect(a.save).toHaveBeenCalledWith('CA', null, { name: 'Civic Holiday', kind: 'nth_weekday', params: { month: 8, weekday: 1, n: 1 }, active: true }));
    expect(await screen.findByText('The first Monday of August')).toBeTruthy();

    const row = screen.getByText('Canada Day', { selector: '.cal-rules__name' }).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(a.remove).toHaveBeenCalledWith('CA', 1));
    expect(confirm).toHaveBeenCalled();
  });

  it('adds a new place', async () => {
    const a = adapter();
    render(<HolidayRulesEditor adapter={a} />);
    await screen.findByText('July 1');

    fireEvent.change(screen.getByLabelText('Code (e.g. KE or CA-ON)'), { target: { value: 'ke' } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Kenya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));

    await waitFor(() => expect(a.putRegion).toHaveBeenCalledWith('KE', 'Kenya'));
  });
});

describe('CalendarConnectionsPanel', () => {
  const row = (over: Partial<CalendarConnection> = {}): CalendarConnection => ({
    id: 7, provider: 'google', account_email: 'a@b.test', status: 'active', busy_calendars: ['primary'],
    write_calendar: 'primary', last_synced_at: '2026-10-08T12:00:00Z', last_error: null, ...over,
  });

  it('connects, flags a connection that needs reconnecting, and disconnects after asking', async () => {
    let rows = [row(), row({ id: 8, provider: 'microsoft', status: 'needs_reauth', last_error: 'Token revoked' })];
    const a = {
      list: vi.fn(async () => rows),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async (id: number) => { rows = rows.filter((r) => r.id !== id); }),
    };
    render(<CalendarConnectionsPanel adapter={a} confirmDisconnect={async () => true} />);

    expect(await screen.findByText('Needs reconnecting: busy time is not being read.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    await waitFor(() => expect(a.connect).toHaveBeenCalledWith('microsoft'));

    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Calendar' }));
    await waitFor(() => expect(a.connect).toHaveBeenLastCalledWith('google'));

    fireEvent.click(within(screen.getByText('Google Calendar', { selector: '.cal-conns__provider' }).closest('li')!).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(a.disconnect).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByText('Google Calendar', { selector: '.cal-conns__provider' })).toBeNull());
  });
});
