import { useId, useState } from 'react';
import type { MeetingNote, MeetingNotesState } from '../hooks/useMeetingNotes';
import { cx, useCalendarUi } from '../theme';
import { formatZonedDateTime } from '../zoned';
import { RowMenu, type RowMenuItem } from './RowMenu';

export interface MeetingNotesPanelProps {
  /** From useMeetingNotes. */
  notes: MeetingNotesState;
  /** IANA zone the note times are shown in. */
  timezone: string;
  /** Show the composer (default true). */
  canWrite?: boolean;
  /** Offer "Only visible to me" (default true). */
  allowPrivate?: boolean;
  /** Ask before deleting (the product's own dialog); defaults to window.confirm. */
  confirmDelete?: (note: MeetingNote, question: string) => Promise<boolean>;
  /** A short success message for the person ("Added to the case notes.", "Copied."). */
  onNotice?: (message: string) => void;
  /** A failure the hook could not show inline (clipboard). */
  onError?: (error: unknown) => void;
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * A meeting's notes, the same in every product: a composer, then the notes oldest first. Each
 * note's actions sit behind ONE kebab: Edit (the author's own), Copy text, the product's own
 * actions ("Convert to case note"), then Delete last behind a confirm.
 */
export function MeetingNotesPanel({
  notes: state, timezone, canWrite = true, allowPrivate = true, confirmDelete, onNotice, onError, describeError, className,
}: MeetingNotesPanelProps) {
  const { labels, classNames } = useCalendarUi();
  const id = useId();
  const [draft, setDraft] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const describe = describeError ?? ((e: unknown) => (e instanceof Error && e.message ? e.message : labels.notesFailed));
  const ask = confirmDelete ?? (async (_n: MeetingNote, q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

  const add = async () => {
    if (draft.trim() === '') return;
    if (await state.add(draft.trim(), isPrivate)) {
      setDraft('');
      setPrivate(false);
    }
  };

  const copy = async (note: MeetingNote) => {
    try {
      await navigator.clipboard.writeText(note.content);
      onNotice?.(labels.notesCopied);
    } catch (e) {
      onError?.(e);
    }
  };

  const items = (note: MeetingNote): RowMenuItem[] => [
    ...(note.mine ? [{ label: labels.notesEdit, onSelect: () => setEditing({ id: note.id, text: note.content }) }] : []),
    { label: labels.notesCopy, onSelect: () => void copy(note) },
    ...note.actions.map((a) => ({
      label: a.label,
      onSelect: () => void state.run(note.id, a.key).then((m) => m && onNotice?.(m)),
    })),
    ...(note.mine
      ? [{ label: labels.notesDelete, danger: true, onSelect: () => void ask(note, labels.notesDeleteAsk).then((yes) => yes && state.remove(note.id)) }]
      : []),
  ];

  return (
    <section className={cx('cal-notes', classNames.notes, className)} aria-labelledby={`${id}-title`}>
      <p className="cal-notes__title" id={`${id}-title`}>{labels.notesTitle}</p>

      {state.status === 'loading' ? (
        <p className="cal-notes__empty">{labels.notesLoading}</p>
      ) : state.notes.length === 0 ? (
        <p className="cal-notes__empty">{labels.notesEmpty}</p>
      ) : (
        <ul className="cal-notes__list">
          {state.notes.map((note) => (
            <li key={note.id} className="cal-notes__item">
              <div className="cal-notes__meta">
                <span className="cal-notes__author">{note.author_name ?? labels.notesSomeone}</span>
                {note.created_at && <span className="cal-notes__when">{formatZonedDateTime(note.created_at, timezone)}</span>}
                {note.private && <span className="cal-notes__badge">{labels.notesPrivateBadge}</span>}
                <span className="cal-notes__menu">
                  <RowMenu label={labels.notesMenu} items={items(note)} disabled={state.busy === note.id} />
                </span>
              </div>
              {editing?.id === note.id ? (
                <div className="cal-notes__edit">
                  <textarea
                    className={cx('cal-notes__field', classNames.input)}
                    aria-label={labels.notesEdit}
                    value={editing.text}
                    onChange={(e) => setEditing({ id: note.id, text: e.target.value })}
                  />
                  <div className="cal-notes__actions">
                    <button type="button" className={cx('cal-btn', classNames.button)} onClick={() => setEditing(null)}>
                      {labels.notesCancel}
                    </button>
                    <button
                      type="button"
                      className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)}
                      disabled={editing.text.trim() === '' || state.busy === note.id}
                      onClick={() => void state.update(note.id, { content: editing.text.trim() }).then((ok) => ok && setEditing(null))}
                    >
                      {labels.notesSave}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="cal-notes__content">{note.content}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.error != null && <p className="cal-notes__error" role="alert">{describe(state.error)}</p>}

      {canWrite && (
        <div className="cal-notes__composer">
          <textarea
            className={cx('cal-notes__field', classNames.input)}
            aria-label={labels.notesPlaceholder}
            placeholder={labels.notesPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="cal-notes__actions">
            {allowPrivate && (
              <label className="cal-notes__private" title={labels.notesPrivateHint}>
                <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
                <span>{labels.notesPrivate}</span>
              </label>
            )}
            <button
              type="button"
              className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)}
              disabled={draft.trim() === '' || state.busy === 'new'}
              onClick={() => void add()}
            >
              {state.busy === 'new' ? labels.notesAdding : labels.notesAdd}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
