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
/**
 * Somewhere the pad can be filed, as the PRODUCT names it ("Save to case notes"): owner
 * 2026-10-07, "save to case" is customizable per product. The calendar-client kit's endpoint
 * returns these with the pad.
 */
export interface ScratchpadCommitTarget {
  key: string;
  label: string;
}

/**
 * Something the PRODUCT offers on the pad's text ("Clean up with Porter"). It only proposes: the
 * person sees the proposal beside their own text and accepts, edits or dismisses it.
 */
export interface ScratchpadAction {
  key: string;
  label: string;
}

/** What `load` may return: the text alone, or the text with where it can be filed and what can be done to it. */
export type ScratchpadLoaded = string | { content: string; targets?: ScratchpadCommitTarget[]; actions?: ScratchpadAction[] };

/** A product action's proposal for the pad, waiting for the person to decide. */
export interface ScratchpadProposal {
  action: string;
  label: string;
  text: string;
}

export interface ScratchpadAdapter {
  /** The person's saved pad ('' when there is none), optionally with its targets. */
  load: () => Promise<ScratchpadLoaded>;
  saveDraft: (text: string) => Promise<void>;
  /** "Save to …": files the pad somewhere lasting, to `target` when there are several. Absent hides the button. */
  commit?: (text: string, target?: string) => Promise<void>;
  /** Where the pad can be filed, when known up front (a `load` answer with targets replaces these). */
  targets?: ScratchpadCommitTarget[];
  /** A product action's proposed text (never applied by the hook until the person accepts it). */
  propose?: (text: string, action: string) => Promise<string>;
  /** Discard the pad for good (absent: it is saved empty). */
  discard?: () => Promise<void>;
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
  /** One "Save to …" per entry. A single entry with no label uses the provider's default wording. */
  targets: Array<{ key: string | undefined; label: string | undefined }>;
  /** The pad holds something worth asking about when the call ends (ScratchpadWrapUp). */
  hasNotes: boolean;
  setText: (text: string) => void;
  /** Save now if anything changed (call on blur). */
  flush: () => Promise<void>;
  /** File the pad (the adapter's `commit`) to `target`. Resolves true when it was filed. */
  commit: (target?: string) => Promise<boolean>;
  /** Keep the pad as a draft for next time. Resolves true once it is saved. */
  keep: () => Promise<boolean>;
  /** Empty the pad, saved empty. Resolves true once it is. */
  discard: () => Promise<boolean>;
  /** The product's actions on the text ("Clean up with Porter"). */
  actions: ScratchpadAction[];
  /** Ask an action for a proposal; it waits in `proposal` for the person. */
  propose: (action: string) => Promise<void>;
  proposing: string | null;
  proposal: ScratchpadProposal | null;
  /** Use the proposal as the pad's text (saved at once). */
  acceptProposal: () => Promise<void>;
  dismissProposal: () => void;
}

export function useMeetingScratchpad(adapter: ScratchpadAdapter): MeetingScratchpadState {
  const [text, setTextState] = useState('');
  const [status, setStatus] = useState<ScratchpadStatus>('loading');
  const [committing, setCommitting] = useState(false);
  const [commits, setCommits] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [loadedTargets, setLoadedTargets] = useState<ScratchpadCommitTarget[] | null>(null);
  const [actions, setActions] = useState<ScratchpadAction[]>([]);
  const [proposing, setProposing] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ScratchpadProposal | null>(null);

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
        const content = typeof loaded === 'string' ? loaded : loaded.content;
        if (typeof loaded !== 'string' && loaded.targets) setLoadedTargets(loaded.targets);
        if (typeof loaded !== 'string' && loaded.actions) setActions(loaded.actions);
        latest.current = content;
        saved.current = content;
        setTextState(content);
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

  const commit = useCallback(async (target?: string): Promise<boolean> => {
    const run = adapterRef.current.commit;
    const value = latest.current;
    if (!run || value.trim() === '') return false;
    setCommitting(true);
    try {
      await (target === undefined ? run(value) : run(value, target));
      setError(null);
      setCommits((n) => n + 1);
      if (adapterRef.current.clearOnCommit ?? true) {
        latest.current = '';
        saved.current = '';
        setTextState('');
        setStatus('idle');
      }
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setCommitting(false);
    }
  }, []);

  const keep = useCallback(async (): Promise<boolean> => {
    await flush();
    return latest.current === saved.current;
  }, [flush]);

  const discard = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      const drop = adapterRef.current.discard;
      await (drop ? drop() : adapterRef.current.saveDraft(''));
      setProposal(null);
      latest.current = '';
      saved.current = '';
      setTextState('');
      setError(null);
      setStatus('idle');
      return true;
    } catch (e) {
      setError(e);
      setStatus('error');
      return false;
    }
  }, []);

  const propose = useCallback(async (action: string): Promise<void> => {
    const run = adapterRef.current.propose;
    const value = latest.current;
    if (!run || value.trim() === '') return;
    setProposing(action);
    try {
      const proposed = await run(value, action);
      setError(null);
      setProposal({ action, label: actions.find((a) => a.key === action)?.label ?? action, text: proposed });
    } catch (e) {
      setError(e);
    } finally {
      setProposing(null);
    }
  }, [actions]);

  const acceptProposal = useCallback(async (): Promise<void> => {
    if (!proposal) return;
    latest.current = proposal.text;
    setTextState(proposal.text);
    setProposal(null);
    await flush();
  }, [proposal, flush]);

  const dismissProposal = useCallback(() => setProposal(null), []);

  return {
    text,
    status,
    committing,
    commits,
    error,
    canCommit: !!adapter.commit && (loadedTargets ?? adapter.targets ?? [null]).length > 0,
    targets: !adapter.commit
      ? []
      : (loadedTargets ?? adapter.targets)?.map((t) => ({ key: t.key, label: t.label })) ?? [{ key: undefined, label: undefined }],
    hasNotes: text.trim() !== '',
    setText,
    flush,
    commit,
    keep,
    discard,
    actions: adapter.propose ? actions : [],
    propose,
    proposing,
    proposal,
    acceptProposal,
    dismissProposal,
  };
}
