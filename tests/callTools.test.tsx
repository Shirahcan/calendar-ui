import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookingApprovalToggle, CallToolPicker, type CallToolsAdapter, type CallToolsState } from '../src/components/CallToolPicker';

const state = (over: Partial<CallToolsState> = {}): CallToolsState => ({
  choice: null, offered: ['zoom'], requires_approval: false, zoom: [], google_calendar_connected: false, ...over,
});

function adapter(initial: CallToolsState): CallToolsAdapter & { current: CallToolsState } {
  const a = {
    current: initial,
    load: vi.fn(async () => a.current),
    choose: vi.fn(async (tool) => { a.current = { ...a.current, choice: tool }; }),
    connectZoom: vi.fn(async () => undefined),
    disconnectZoom: vi.fn(async () => { a.current = { ...a.current, zoom: [], choice: null }; }),
    setApproval: vi.fn(async () => undefined),
  } as CallToolsAdapter & { current: CallToolsState };
  return a;
}

describe('CallToolPicker', () => {
  it('shows only what is offered or in use, and switches the tool', async () => {
    const a = adapter(state({ zoom: [{ id: 7, account_email: 'me@zoom.test', status: 'active' }] }));
    render(<CallToolPicker adapter={a} />);

    await screen.findByText('Connected as me@zoom.test');
    expect(screen.queryByText('Google Meet')).toBeNull();
    expect(screen.getByText('In use')).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Use this' })));
    expect(a.choose).toHaveBeenCalledWith('zoom');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Use this' })).toHaveLength(1));
  });

  it('connects Zoom when there is no account, and disconnects only after a yes', async () => {
    const a = adapter(state());
    const { unmount } = render(<CallToolPicker adapter={a} />);
    const connect = await screen.findByRole('button', { name: 'Connect' });
    await act(async () => fireEvent.click(connect));
    expect(a.connectZoom).toHaveBeenCalled();
    unmount();

    const b = adapter(state({ choice: 'zoom', zoom: [{ id: 7, account_email: null, status: 'active' }] }));
    const ask = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<CallToolPicker adapter={b} confirmDisconnect={ask} />);
    const menu = await screen.findByRole('button', { name: 'Actions for Zoom' });

    fireEvent.click(menu);
    await act(async () => fireEvent.click(screen.getByRole('menuitem', { name: 'Disconnect' })));
    expect(b.disconnectZoom).not.toHaveBeenCalled();

    fireEvent.click(menu);
    await act(async () => fireEvent.click(screen.getByRole('menuitem', { name: 'Disconnect' })));
    expect(b.disconnectZoom).toHaveBeenCalledWith(7);
  });

  it('asks for a Google calendar before Meet can be chosen', async () => {
    render(<CallToolPicker adapter={adapter(state({ offered: ['google_meet'] }))} meetCalendarLink={<a href="/connections">Connections</a>} />);
    await screen.findByText(/Connect your Google calendar first/);
    expect(screen.getByRole('link', { name: 'Connections' })).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'Use this' })).toHaveLength(0);
  });
});

describe('BookingApprovalToggle', () => {
  it('reads the preference and saves the flip, keeping the old value when saving fails', async () => {
    const save = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Not now.'));
    render(<BookingApprovalToggle adapter={{ load: async () => false, save }} />);

    const toggle = await screen.findByRole('switch', { name: 'Approve each booking' });
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    await act(async () => fireEvent.click(toggle));
    expect(save).toHaveBeenCalledWith(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    await act(async () => fireEvent.click(toggle));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Not now.');
  });
});
