import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A meeting's filed notes, the same in every product. They live on the meeting's booking in
 * calendar-service (calendar-client's notes kit); this hook is headless and storage-free like the
 * rest of the package: the product hands in how to reach them.
 *
 * Each note says whether it is the viewer's (`mine`: they may edit or delete it), whether it is
 * private (only its author reads it), who wrote it, and which product actions it offers
 * ("Convert to case note").
 */
export interface MeetingNote {
  id: string;
  content: string;
  private: boolean;
  mine: boolean;
  author_auth_id: string;
  author_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  actions: Array<{ key: string; label: string }>;
  meta?: Record<string, unknown>;
}

export interface MeetingNotesAdapter {
  list: () => Promise<MeetingNote[]>;
  add: (content: string, isPrivate: boolean) => Promise<MeetingNote>;
  update: (id: string, change: { content?: string; private?: boolean }) => Promise<MeetingNote>;
  remove: (id: string) => Promise<void>;
  /** A product's note action; resolves its message for the person and the note as it now is. */
  run: (id: string, action: string) => Promise<{ message: string; note: MeetingNote }>;
}

export interface MeetingNotesState {
  notes: MeetingNote[];
  status: 'loading' | 'ready' | 'error';
  /** The note (or 'new') a write is running for. */
  busy: string | null;
  error: unknown;
  reload: () => Promise<void>;
  add: (content: string, isPrivate?: boolean) => Promise<boolean>;
  update: (id: string, change: { content?: string; private?: boolean }) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Resolves the action's message (null when it failed: see `error`). */
  run: (id: string, action: string) => Promise<string | null>;
}

export function useMeetingNotes(adapter: MeetingNotesAdapter): MeetingNotesState {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [status, setStatus] = useState<MeetingNotesState['status']>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  // The adapter is usually an inline object; read the latest through a ref so effects stay stable.
  const ref = useRef(adapter);

  useEffect(() => {
    ref.current = adapter;
  });

  const reload = useCallback(async () => {
    try {
      setNotes(await ref.current.list());
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    ref.current.list().then(
      (list) => {
        if (!alive) return;
        setNotes(list);
        setStatus('ready');
      },
      (e: unknown) => {
        if (!alive) return;
        setError(e);
        setStatus('error');
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const write = useCallback(async (key: string, fn: () => Promise<void>): Promise<boolean> => {
    setBusy(key);
    try {
      await fn();
      setError(null);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const replace = (note: MeetingNote) => setNotes((list) => list.map((n) => (n.id === note.id ? note : n)));

  return {
    notes,
    status,
    busy,
    error,
    reload,
    add: (content, isPrivate = false) =>
      write('new', async () => {
        const note = await ref.current.add(content, isPrivate);
        setNotes((list) => [...list, note]);
      }),
    update: (id, change) => write(id, async () => replace(await ref.current.update(id, change))),
    remove: (id) =>
      write(id, async () => {
        await ref.current.remove(id);
        setNotes((list) => list.filter((n) => n.id !== id));
      }),
    run: async (id, action) => {
      let message: string | null = null;
      const ok = await write(id, async () => {
        const result = await ref.current.run(id, action);
        replace(result.note);
        message = result.message;
      });

      return ok ? message : null;
    },
  };
}
