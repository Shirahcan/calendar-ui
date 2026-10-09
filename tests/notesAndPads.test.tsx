import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MeetingNotesPanel } from '../src/components/MeetingNotesPanel';
import { MeetingScratchpad } from '../src/components/MeetingScratchpad';
import { PendingPadsBanner, type PendingPad } from '../src/components/PendingPads';
import { useMeetingNotes, type MeetingNote, type MeetingNotesAdapter } from '../src/hooks/useMeetingNotes';
import { useMeetingScratchpad, type ScratchpadAdapter } from '../src/hooks/useMeetingScratchpad';
import { kitMeetingNotesAdapter } from '../src/kitMeetingNotes';

const note = (over: Partial<MeetingNote> = {}): MeetingNote => ({
  id: 'n1', content: 'Funds look fine', private: false, mine: true, author_auth_id: 'u1', author_name: 'Elena Rodriguez',
  created_at: '2026-10-09T15:00:00Z', updated_at: null, actions: [], ...over,
});

function Notes(props: { adapter: MeetingNotesAdapter; confirmDelete?: (n: MeetingNote, q: string) => Promise<boolean>; onNotice?: (m: string) => void }) {
  return <MeetingNotesPanel notes={useMeetingNotes(props.adapter)} timezone="UTC" confirmDelete={props.confirmDelete} onNotice={props.onNotice} />;
}

function adapter(over: Partial<MeetingNotesAdapter> = {}): MeetingNotesAdapter {
  return {
    list: async () => [note(), note({ id: 'n2', content: 'Their note', mine: false, author_name: 'Ana', actions: [{ key: 'convert', label: 'Convert to case note' }] })],
    add: async (content, isPrivate) => note({ id: 'n3', content, private: isPrivate }),
    update: async (id, change) => note({ id, content: change.content ?? '' }),
    remove: async () => undefined,
    run: async (id) => ({ message: 'Added to the case notes.', note: note({ id, content: 'Their note', mine: false, author_name: 'Ana' }) }),
    ...over,
  };
}

describe('MeetingNotesPanel', () => {
  it('lists notes with their author and files a private one', async () => {
    const add = vi.fn(async (content: string, isPrivate: boolean) => note({ id: 'n3', content, private: isPrivate }));
    render(<Notes adapter={adapter({ add })} />);

    expect(await screen.findByText('Funds look fine')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Write a note about this meeting…'), { target: { value: 'Doubt the plan' } });
    fireEvent.click(screen.getByLabelText('Only visible to me'));
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(add).toHaveBeenCalledWith('Doubt the plan', true));
    expect(await screen.findByText('Doubt the plan')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
  });

  it('puts a note\'s actions behind one kebab: only the author edits or deletes, product actions run', async () => {
    const run = vi.fn(adapter().run);
    const notice = vi.fn();
    render(<Notes adapter={adapter({ run })} onNotice={notice} />);
    await screen.findByText('Their note');

    const theirs = screen.getByText('Their note').closest('li') as HTMLElement;
    fireEvent.click(within(theirs).getByRole('button', { name: 'Note actions' }));
    expect(within(theirs).queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    expect(within(theirs).queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    fireEvent.click(within(theirs).getByRole('menuitem', { name: 'Convert to case note' }));

    await waitFor(() => expect(run).toHaveBeenCalledWith('n2', 'convert'));
    await waitFor(() => expect(notice).toHaveBeenCalledWith('Added to the case notes.'));
  });

  it('deletes only after the product confirms', async () => {
    const remove = vi.fn(async () => undefined);
    const confirmDelete = vi.fn(async () => true);
    render(<Notes adapter={adapter({ remove })} confirmDelete={confirmDelete} />);
    await screen.findByText('Funds look fine');

    const mine = screen.getByText('Funds look fine').closest('li') as HTMLElement;
    fireEvent.click(within(mine).getByRole('button', { name: 'Note actions' }));
    fireEvent.click(within(mine).getByRole('menuitem', { name: 'Delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('n1'));
    expect(confirmDelete).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Funds look fine')).toBeNull());
  });

  it('talks to the kit routes', async () => {
    const request = vi.fn(async (method: string, path: string, body?: unknown) => ({ data: method === 'GET' ? [] : { id: 'x', path, body } }));
    const kit = kitMeetingNotesAdapter({ path: '/v1/calendar/meetings/m1/', request: request as never });
    await kit.list();
    await kit.update('n 1', { content: 'x' });
    await kit.run('n1', 'convert');
    expect(request.mock.calls.map((c) => `${c[0]} ${c[1]}`)).toEqual([
      'GET /v1/calendar/meetings/m1/notes',
      'PATCH /v1/calendar/meetings/m1/notes/n%201',
      'POST /v1/calendar/meetings/m1/notes/n1/actions/convert',
    ]);
  });
});

function Pad({ adapter: a }: { adapter: ScratchpadAdapter }) {
  return <MeetingScratchpad scratchpad={useMeetingScratchpad(a)} />;
}

describe('pad actions', () => {
  it('shows a proposal beside the text and changes nothing until it is accepted', async () => {
    const saveDraft = vi.fn().mockResolvedValue(undefined);
    const propose = vi.fn(async (text: string) => text.toUpperCase());
    render(<Pad adapter={{ load: async () => ({ content: 'funds ok', actions: [{ key: 'tidy', label: 'Clean up with Porter' }] }), saveDraft, propose, idleMs: 60_000 }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Clean up with Porter' }));
    expect(await screen.findByText('FUNDS OK')).toBeTruthy();
    expect(propose).toHaveBeenCalledWith('funds ok', 'tidy');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('funds ok');
    expect(saveDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use this version' }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith('FUNDS OK'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('FUNDS OK');
  });

  it('keeps the person\'s text when they keep theirs', async () => {
    render(<Pad adapter={{ load: async () => ({ content: 'raw', actions: [{ key: 'tidy', label: 'Tidy' }] }), saveDraft: vi.fn(), propose: async () => 'TIDY' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tidy' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep mine' }));
    expect(screen.queryByText('TIDY')).toBeNull();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('raw');
  });
});

describe('PendingPadsBanner', () => {
  const pad: PendingPad = { meeting_id: 'm1', title: 'Study permit review', href: '/m1', content: 'follow up on funds', updated_at: null, start_utc: '2026-10-11T15:00:00Z' };

  it('lists unsettled pads and discards one after a confirm', async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
    let pads = [pad];
    const discard = vi.fn(async () => { pads = []; });
    render(
      <PendingPadsBanner
        timezone="UTC"
        confirmDiscard={async () => true}
        adapter={{ list: async () => pads, padFor: () => ({ load: async () => pad.content, saveDraft: vi.fn(), discard }) }}
      />,
    );

    expect(await screen.findByText('You have call notes that are not saved anywhere yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByDisplayValue('follow up on funds')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Discard notes' }));
    await waitFor(() => expect(discard).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('You have call notes that are not saved anywhere yet')).toBeNull());
  });

  it('shows nothing when there is nothing to settle', async () => {
    const { container } = render(<PendingPadsBanner timezone="UTC" adapter={{ list: async () => [], padFor: () => ({ load: async () => '', saveDraft: vi.fn() }) }} />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
