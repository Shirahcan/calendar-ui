import type { MeetingNote, MeetingNotesAdapter } from './hooks/useMeetingNotes';

/**
 * The adapter for calendar-client's notes kit (CalendarKit::meetingNotesRoutes), so no product
 * writes its own. The product supplies only its authenticated request function and the meeting's
 * path (the prefix the routes were mounted under plus the meeting id).
 */
export interface KitMeetingNotesOptions {
  path: string;
  request: <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) => Promise<T>;
}

export function kitMeetingNotesAdapter({ path, request }: KitMeetingNotesOptions): MeetingNotesAdapter {
  const base = `${path.replace(/\/+$/, '')}/notes`;

  return {
    list: async () => (await request<{ data: MeetingNote[] }>('GET', base)).data ?? [],
    add: async (content, isPrivate) => (await request<{ data: MeetingNote }>('POST', base, { content, private: isPrivate })).data,
    update: async (id, change) => (await request<{ data: MeetingNote }>('PATCH', `${base}/${encodeURIComponent(id)}`, change)).data,
    remove: async (id) => {
      await request('DELETE', `${base}/${encodeURIComponent(id)}`);
    },
    run: async (id, action) =>
      (await request<{ data: { message: string; note: MeetingNote } }>('POST', `${base}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action)}`)).data,
  };
}
