import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BackupCallAccountPanel, type BackupCallAccount } from '../src/components/BackupCallAccountPanel';
import { SchedulingPolicyEditor, type SchedulingPolicyState } from '../src/components/SchedulingPolicyEditor';
import type { SchedulingPolicy } from '../src/types';

const POLICY: SchedulingPolicy = {
  min_buffer_minutes: 0,
  max_buffer_minutes: 240,
  default_buffer_minutes: 0,
  buffer_choices: [0, 5, 10],
  min_notice_minutes: 0,
  horizon_days: 60,
  hold_seconds: 900,
  seed_weekly: [{ days: ['mon'], start: '09:00', end: '17:00' }],
  observe_holidays_by_default: true,
  call_tools_offered: ['zoom'],
  backup_call_tool: null,
};

describe('SchedulingPolicyEditor calls', () => {
  it('offers Google Meet to people and turns on the backup call', async () => {
    let state: SchedulingPolicyState = { policy: POLICY, is_default: false };
    const save = vi.fn(async (p: SchedulingPolicy | null) => (state = {
      policy: p ?? POLICY, is_default: false,
      offered: { call_tools: ['zoom', 'google_meet'], calendar_providers: ['google'], backup_call: { tool: 'google_meet', ready: false, reason: 'No backup call account is connected.' } },
    }));
    render(<SchedulingPolicyEditor adapter={{ load: async () => state, save }} />);

    fireEvent.click(await screen.findByLabelText('Google Meet'));
    fireEvent.change(screen.getByLabelText('Backup when a call cannot be rescued'), { target: { value: 'google_meet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]![0]).toMatchObject({ call_tools_offered: ['zoom', 'google_meet'], backup_call_tool: 'google_meet' });
    await screen.findByText(/Not available yet: No backup call account is connected\./);
  });
});

describe('BackupCallAccountPanel', () => {
  const account: BackupCallAccount = { id: 3, provider: 'google', account_email: 'calls@shirah.co', status: 'active', last_error: null };

  it('connects when there is none and says the account must let guests in', async () => {
    const connect = vi.fn(async () => undefined);
    render(<BackupCallAccountPanel adapter={{ load: async () => null, connect, disconnect: async () => undefined }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect a Google account' }));
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Meet access is set to "Open"/)).toBeTruthy();
  });

  it('shows the account and disconnects only after confirming', async () => {
    let current: BackupCallAccount | null = account;
    const disconnect = vi.fn(async () => { current = null; });
    const confirm = vi.fn(async (_a: BackupCallAccount, _q: string) => true);
    render(<BackupCallAccountPanel adapter={{ load: async () => current, connect: async () => undefined, disconnect }} confirmDisconnect={confirm} />);

    expect(await screen.findByText('calls@shirah.co')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for calls@shirah.co' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Disconnect' }));

    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
    expect(confirm.mock.calls[0]![1]).toContain('calls@shirah.co');
    await screen.findByText('No backup account connected yet.');
  });

  it('says when the account needs reconnecting', async () => {
    render(<BackupCallAccountPanel adapter={{ load: async () => ({ ...account, status: 'needs_reauth', last_error: 'invalid_grant' }), connect: async () => undefined, disconnect: async () => undefined }} />);

    expect(await screen.findByText(/Needs reconnecting/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeTruthy();
  });
});
