import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MeetingScratchpad } from '../src/components/MeetingScratchpad';
import { useMeetingScratchpad, type ScratchpadAdapter } from '../src/hooks/useMeetingScratchpad';
import { CalendarUiProvider } from '../src/theme';

function Pad({ adapter }: { adapter: ScratchpadAdapter }) {
  return <MeetingScratchpad scratchpad={useMeetingScratchpad(adapter)} />;
}

describe('MeetingScratchpad', () => {
  it('loads the saved pad and saves on blur, never per keystroke', async () => {
    const saveDraft = vi.fn().mockResolvedValue(undefined);
    render(<Pad adapter={{ load: async () => 'earlier', saveDraft, idleMs: 60_000 }} />);

    const field = await screen.findByDisplayValue('earlier');
    fireEvent.change(field, { target: { value: 'earlier, then more' } });
    fireEvent.change(field, { target: { value: 'earlier, then more again' } });
    expect(saveDraft).not.toHaveBeenCalled();

    fireEvent.blur(field);
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith('earlier, then more again'));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('autosaves after a pause in typing', async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue(undefined);
    render(<Pad adapter={{ load: async () => '', saveDraft, idleMs: 500 }} />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'note' } });
    await act(async () => { vi.advanceTimersByTime(600); });
    vi.useRealTimers();
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith('note'));
  });

  it('shows the commit button only when the product gives one, and clears after it', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<Pad adapter={{ load: async () => '', saveDraft: async () => undefined }} />);
    await screen.findByRole('textbox');
    expect(screen.queryByRole('button')).toBeNull();
    unmount();

    render(
      <CalendarUiProvider labels={{ scratchpadCommit: 'Save to case' }}>
        <Pad adapter={{ load: async () => 'decided X', saveDraft: async () => undefined, commit }} />
      </CalendarUiProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Save to case' }));
    await waitFor(() => expect(commit).toHaveBeenCalledWith('decided X'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('saves through the unload path when the page is hidden', async () => {
    const saveOnUnload = vi.fn().mockReturnValue(true);
    const saveDraft = vi.fn().mockResolvedValue(undefined);
    render(<Pad adapter={{ load: async () => '', saveDraft, saveOnUnload, idleMs: 60_000 }} />);
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'typed, never blurred' } });

    window.dispatchEvent(new Event('pagehide'));
    expect(saveOnUnload).toHaveBeenCalledWith('typed, never blurred');
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('names a failed save', async () => {
    render(<Pad adapter={{ load: async () => '', saveDraft: async () => { throw new Error('Offline'); }, idleMs: 60_000 }} />);
    const field = await screen.findByRole('textbox');
    fireEvent.change(field, { target: { value: 'x' } });
    fireEvent.blur(field);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Offline');
  });
});
