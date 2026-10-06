import type { ScratchpadAdapter, ScratchpadCommitTarget } from './hooks/useMeetingScratchpad';

/**
 * The adapter for calendar-client's scratchpad kit (CalendarKit::scratchpadRoutes), so no
 * product writes its own: the pad's storage, its targets and their wording all come from the
 * product's server through the kit. The product supplies only its authenticated request function
 * (its own API client, cookies, tokens) and the meeting's path.
 */
export interface KitScratchpadOptions {
  /** The prefix the routes were mounted under plus the meeting id: `/v1/calendar/meetings/123`. */
  path: string;
  /** The product's request function; resolves the parsed JSON body, rejects on an error status. */
  request: <T>(method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown) => Promise<T>;
  saveOnUnload?: (text: string) => boolean;
  idleMs?: number;
}

interface KitPad {
  data: { content?: string | null; targets?: ScratchpadCommitTarget[] };
}

export function kitScratchpadAdapter({ path, request, saveOnUnload, idleMs }: KitScratchpadOptions): ScratchpadAdapter {
  const base = `${path.replace(/\/+$/, '')}/scratchpad`;

  return {
    load: async () => {
      const pad = await request<KitPad>('GET', base);
      return { content: pad.data.content ?? '', targets: pad.data.targets ?? [] };
    },
    saveDraft: async (text) => {
      await request('PUT', base, { content: text });
    },
    commit: async (text, target) => {
      await request('POST', `${base}/commit`, { target, content: text });
    },
    saveOnUnload,
    idleMs,
  };
}
