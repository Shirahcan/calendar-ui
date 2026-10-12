import { useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { useConfirm } from './ConfirmDialog';
import { PersonLocalTime } from './MeetingPanels';
import { RowMenu, type RowMenuItem } from './RowMenu';

/** One person on a meeting, as the booking holds them. */
export interface MeetingParticipantView {
  id: string;
  name?: string | null;
  email?: string | null;
  /** Their place on the booking: host (organizer or co-host), the booker (client), an invitee, a guest. */
  kind: 'organizer' | 'host' | 'booker' | 'attendee' | 'guest';
  response?: 'pending' | 'accepted' | 'declined' | string | null;
  /** After the call: came, or did not. Null before it. */
  attended?: boolean | null;
  /** Their own zone (IANA), when the viewer may see it: the meeting on THEIR clock shows under them. */
  zone?: string | null;
  /** The product allows taking them off (an invitee or a guest, for someone who manages the meeting). */
  removable?: boolean;
}

export interface MeetingParticipantsPanelProps {
  participants: MeetingParticipantView[];
  start_utc: string;
  end_utc: string;
  loading?: boolean;
  /** Offer the "Invite someone" form; the product does the add. Throws to show the reason. */
  onAdd?: (input: { email: string; name?: string; optional: boolean }) => Promise<void>;
  /** Take an invitee off; the product does it. Throws to show the reason. */
  onRemove?: (participant: MeetingParticipantView) => Promise<void>;
  /** A short success message ("Copied."). */
  onNotice?: (message: string) => void;
  /** A failure the panel could not show inline (clipboard). */
  onError?: (error: unknown) => void;
  describeError?: (error: unknown) => string;
  className?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Who is on a meeting, the same in every product: each person with their place on the call, their
 * answer, whether they came, and (when the product gives it) the meeting on their own clock. Each
 * row's actions sit behind ONE kebab: Copy email, then Remove last behind a confirm. Below, a
 * short form invites someone else.
 */
export function MeetingParticipantsPanel({
  participants, start_utc, end_utc, loading = false, onAdd, onRemove, onNotice, onError, describeError, className,
}: MeetingParticipantsPanelProps) {
  const { labels, classNames } = useCalendarUi();
  const id = useId();
  const [confirmNode, ask] = useConfirm();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [optional, setOptional] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const describe = describeError ?? ((e: unknown) => (e instanceof Error && e.message ? e.message : labels.participantsFailed));

  const add = async () => {
    const value = email.trim();
    if (!onAdd || !EMAIL.test(value)) {
      setError(labels.participantsBadEmail);
      return;
    }
    setBusy('add');
    setError(null);
    try {
      await onAdd({ email: value, name: name.trim() || undefined, optional });
      setEmail('');
      setName('');
      setOptional(false);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: MeetingParticipantView) => {
    if (!onRemove || !(await ask(labels.participantsRemoveAsk(p.name || p.email || ''), labels.participantsRemove))) return;
    setBusy(p.id);
    setError(null);
    try {
      await onRemove(p);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onNotice?.(labels.participantsCopied);
    } catch (e) {
      onError?.(e);
    }
  };

  const items = (p: MeetingParticipantView): RowMenuItem[] => [
    ...(p.email ? [{ label: labels.participantsCopyEmail, onSelect: () => void copy(p.email!) }] : []),
    ...(p.removable && onRemove ? [{ label: labels.participantsRemove, danger: true, onSelect: () => void remove(p) }] : []),
  ];

  return (
    <section className={cx('cal-notes', 'cal-people', classNames.notes, className)} aria-labelledby={`${id}-title`}>
      <p className="cal-notes__title" id={`${id}-title`}>{labels.participantsTitle}</p>

      {loading ? (
        <p className="cal-notes__empty">{labels.participantsLoading}</p>
      ) : participants.length === 0 ? (
        <p className="cal-notes__empty">{labels.participantsEmpty}</p>
      ) : (
        <ul className="cal-notes__list">
          {participants.map((p) => {
            const menu = items(p);
            const state = p.attended === true ? 'attended' : p.attended === false ? 'no_show' : p.response ?? null;

            return (
              <li key={p.id} className="cal-notes__item">
                <div className="cal-notes__meta">
                  <span className="cal-notes__author">{p.name || p.email || labels.notesSomeone}</span>
                  <span className="cal-notes__badge">{labels.participantKind(p.kind)}</span>
                  {state && (
                    <span className="cal-meeting-side__state" data-state={state}>
                      {p.attended != null ? labels.meetingAttendance(state) : labels.meetingResponse(state)}
                    </span>
                  )}
                  {menu.length > 0 && (
                    <span className="cal-notes__menu">
                      <RowMenu label={labels.participantsMenu(p.name || p.email || '')} items={menu} disabled={busy === p.id} />
                    </span>
                  )}
                </div>
                {p.name && p.email && <p className="cal-meeting-side__email">{p.email}</p>}
                <PersonLocalTime start={start_utc} end={end_utc} zone={p.zone} />
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="cal-notes__error" role="alert">{error}</p>}

      {onAdd && (
        <div className="cal-notes__composer">
          <p className="cal-people__formtitle">{labels.participantsInvite}</p>
          <div className="cal-people__fields">
            <input
              type="email"
              className={cx('cal-people__field', classNames.input)}
              aria-label={labels.participantsEmail}
              placeholder={labels.participantsEmail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="text"
              className={cx('cal-people__field', classNames.input)}
              aria-label={labels.participantsName}
              placeholder={labels.participantsName}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="cal-notes__actions">
            <label className="cal-notes__private" title={labels.participantsOptionalHint}>
              <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
              <span>{labels.participantsOptional}</span>
            </label>
            <button
              type="button"
              className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)}
              disabled={busy === 'add' || email.trim() === ''}
              onClick={() => void add()}
            >
              {busy === 'add' ? labels.participantsAdding : labels.participantsAdd}
            </button>
          </div>
        </div>
      )}
      {confirmNode}
    </section>
  );
}
