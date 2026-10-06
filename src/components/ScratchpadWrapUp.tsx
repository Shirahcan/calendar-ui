import { useId, useState } from 'react';
import type { MeetingScratchpadState } from '../hooks/useMeetingScratchpad';
import { cx, useCalendarUi } from '../theme';

export interface ScratchpadWrapUpProps {
  /** From useMeetingScratchpad: the same pad the room showed. */
  scratchpad: MeetingScratchpadState;
  /** The person chose (filed, kept or discarded the pad): the product moves them on. */
  onDone: (choice: 'committed' | 'kept' | 'discarded') => void;
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * The call is over and the pad still holds notes (owner 2026-10-06: "if the consultant/admin
 * has anything in their scratchpad then they should be offered applicable options"):
 *
 *   You have notes in your scratchpad
 *   ┌ the notes, read-only, scrolling ┐
 *   [Save to case] [Keep as a draft] [Discard]
 *
 * "Save to …" shows only when the product gave the hook a `commit`. "Keep" saves the draft, so
 * the pad opens with it next time. "Discard" asks once more before emptying it. A product with
 * nothing in the pad never needs to render this (`hasNotes` below).
 */
export function ScratchpadWrapUp({ scratchpad: pad, onDone, describeError, className }: ScratchpadWrapUpProps) {
  const { labels, classNames } = useCalendarUi();
  const titleId = useId();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const describe = describeError ?? ((error: unknown) => (error instanceof Error && error.message ? error.message : labels.scratchpadFailed));

  const run = async (choice: 'committed' | 'kept' | 'discarded') => {
    setBusy(true);
    try {
      const ok = choice === 'committed' ? await pad.commit() : choice === 'kept' ? await pad.keep() : await pad.discard();
      if (ok) onDone(choice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cx('cal-scratchpad', 'cal-wrapup', classNames.scratchpad, className)} aria-labelledby={titleId}>
      <p className="cal-scratchpad__title" id={titleId}>{labels.wrapUpTitle}</p>
      <p className="cal-scratchpad__hint">{labels.wrapUpHint}</p>
      <div className="cal-wrapup__notes" tabIndex={0} aria-label={labels.scratchpadTitle}>{pad.text}</div>
      {pad.error != null && <p className="cal-scratchpad__error" role="alert">{describe(pad.error)}</p>}
      {confirmDiscard ? (
        <div className="cal-wrapup__actions" role="group" aria-label={labels.wrapUpDiscardConfirm}>
          <span className="cal-wrapup__ask">{labels.wrapUpDiscardConfirm}</span>
          <button type="button" className={cx('cal-btn', 'cal-btn--danger', classNames.button)} disabled={busy} onClick={() => void run('discarded')}>
            {labels.wrapUpDiscardYes}
          </button>
          <button type="button" className={cx('cal-btn', classNames.button)} disabled={busy} onClick={() => setConfirmDiscard(false)}>
            {labels.wrapUpDiscardNo}
          </button>
        </div>
      ) : (
        <div className="cal-wrapup__actions">
          {pad.canCommit && (
            <button
              type="button"
              className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)}
              disabled={busy || pad.committing}
              onClick={() => void run('committed')}
            >
              {pad.committing ? labels.scratchpadCommitting : labels.scratchpadCommit}
            </button>
          )}
          <button type="button" className={cx('cal-btn', classNames.button)} disabled={busy} onClick={() => void run('kept')}>
            {labels.wrapUpKeep}
          </button>
          <button type="button" className={cx('cal-btn', 'cal-btn--ghost', classNames.button)} disabled={busy} onClick={() => setConfirmDiscard(true)}>
            {labels.wrapUpDiscard}
          </button>
        </div>
      )}
    </section>
  );
}
