import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A private pad for the person running a call, kept while the call is on (owner 2026-10-05:
 * "it's meant to be used while the call is ongoing, inside the meeting room", shared by every
 * product, each deciding whether its room shows it and for whom).
 *
 * Headless and storage-free, like the rest of this package: the product hands in how to load,
 * save and (optionally) file the pad, and owns what those mean (Portify files it to the case as
 * a staff note; another product may keep it on the booking).
 *
 * Saving: when the field loses focus, after a short pause in typing, when the component goes
 * away, and on page hide through `saveOnUnload` (an ordinary request does not survive a closed
 * tab, and losing someone's call notes is the worst thing a pad can do).
 */
export interface ScratchpadAdapter {
  /** The person's saved pad, or '' when there is none. */
  load: () => Promise<string>;
  saveDraft: (text: string) => Promise<void>;
  /** "Save to …": files the pad somewhere lasting. Absent hides the button. */
  commit?: (text: string) => Promise<void>;
  /** Fire-and-forget save while the page goes away (fetch keepalive). False when it could not try. */
  saveOnUnload?: (text: string) => boolean;
  /** Empty the pad after a commit (default true). */
  clearOnCommit?: boolean;
  /** Milliseconds of quiet typing before an autosave (default 2000). */
  idleMs?: number;
}

export type ScratchpadStatus = 'loading' | 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export interface MeetingScratchpadState {
  text: string;
  status: ScratchpadStatus;
  committing: boolean;
  /** Bumped after each successful commit, so a product can say "Saved". */
  commits: number;
  error: unknown;
  canCommit: boolean;
  setText: (text: string) => void;
  /** Save now if anything changed (call on blur). */
  flush: () => Promise<void>;
  commit: () => Promise<void>;
}

export function useMeetingScratchpad(adapter: ScratchpadAdapter): MeetingScratchpadState {
  const [text, setTextState] = useState('');
  const [status, setStatus] = useState<ScratchpadStatus>('loading');
  const [committing, setCommitting] = useState(false);
  const [commits, setCommits] = useState(0);
  const [error, setError] = useState<unknown>(null);

  // The adapter is usually an inline object; read the latest through a ref so effects stay stable.
  const adapterRef = useRef(adapter);
  const latest = useRef('');
  const saved = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    adapterRef.current = adapter;
  });

  useEffect(() => {
    let alive = true;
    adapterRef.current.load().then(
      (loaded) => {
        if (!alive) return;
        latest.current = loaded;
        saved.current = loaded;
        setTextState(loaded);
        setStatus('idle');
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

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const value = latest.current;
    if (value === saved.current) return;
    setStatus('saving');
    try {
      await adapterRef.current.saveDraft(value);
      saved.current = value;
      setError(null);
      setStatus(latest.current === value ? 'saved' : 'unsaved');
    } catch (e) {
      setError(e);
      setStatus('error');
    }
  }, []);

  const setText = useCallback((next: string) => {
    latest.current = next;
    setTextState(next);
    setStatus(next === saved.current ? 'saved' : 'unsaved');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), adapterRef.current.idleMs ?? 2000);
  }, [flush]);

  // Page hide (tab closed, app switched, laptop lid) and unmount: never lose the pad.
  useEffect(() => {
    const onHide = () => {
      if (latest.current === saved.current) return;
      const sent = adapterRef.current.saveOnUnload?.(latest.current) ?? false;
      if (sent) saved.current = latest.current;
      else void flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      if (timer.current) clearTimeout(timer.current);
      onHide();
    };
  }, [flush]);

  const commit = useCallback(async () => {
    const run = adapterRef.current.commit;
    const value = latest.current;
    if (!run || value.trim() === '') return;
    setCommitting(true);
    try {
      await run(value);
      setError(null);
      setCommits((n) => n + 1);
      if (adapterRef.current.clearOnCommit ?? true) {
        latest.current = '';
        saved.current = '';
        setTextState('');
        setStatus('idle');
      }
    } catch (e) {
      setError(e);
    } finally {
      setCommitting(false);
    }
  }, []);

  return {
    text,
    status,
    committing,
    commits,
    error,
    canCommit: !!adapter.commit,
    setText,
    flush,
    commit,
  };
}
