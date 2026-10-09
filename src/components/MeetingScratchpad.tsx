import { useId } from 'react';
import type { MeetingScratchpadState } from '../hooks/useMeetingScratchpad';
import { cx, useCalendarUi } from '../theme';
import { PadActions, PadProposal } from './PadProposal';

export interface MeetingScratchpadProps {
  /** From useMeetingScratchpad. */
  scratchpad: MeetingScratchpadState;
  /** The product's way of turning a failure into a sentence; defaults to the error's message. */
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * The pad beside a live call:
 *
 *   Scratchpad                          Saved
 *   Only you see this. Save it when you are done.
 *   [ textarea                                 ]
 *                                  [Save to case]
 *
 * Every sentence comes from the provider's labels; the commit button shows only when the
 * product gave the hook a `commit`.
 */
export function MeetingScratchpad({ scratchpad: pad, describeError, className }: MeetingScratchpadProps) {
  const { labels, classNames } = useCalendarUi();
  const fieldId = useId();
  const describe = describeError ?? ((error: unknown) => (error instanceof Error && error.message ? error.message : labels.scratchpadFailed));

  const statusText =
    pad.status === 'loading' ? labels.scratchpadLoading
      : pad.status === 'saving' ? labels.scratchpadSaving
        : pad.status === 'saved' ? labels.scratchpadSaved
          : pad.status === 'unsaved' ? labels.scratchpadUnsaved
            : '';

  return (
    <section className={cx('cal-scratchpad', classNames.scratchpad, className)} aria-labelledby={`${fieldId}-title`}>
      <div className="cal-scratchpad__head">
        <p className="cal-scratchpad__title" id={`${fieldId}-title`}>{labels.scratchpadTitle}</p>
        <span className="cal-scratchpad__status" role="status">{statusText}</span>
      </div>
      <p className="cal-scratchpad__hint">{labels.scratchpadHint}</p>
      <textarea
        id={fieldId}
        className="cal-scratchpad__field"
        aria-labelledby={`${fieldId}-title`}
        value={pad.text}
        placeholder={labels.scratchpadPlaceholder}
        disabled={pad.status === 'loading'}
        onChange={(e) => pad.setText(e.target.value)}
        onBlur={() => void pad.flush()}
      />
      <PadActions scratchpad={pad} />
      <PadProposal scratchpad={pad} />
      {pad.error != null && <p className="cal-scratchpad__error" role="alert">{describe(pad.error)}</p>}
      {pad.canCommit && (
        <div className="cal-scratchpad__actions">
          {pad.commits > 0 && pad.text === '' && <span className="cal-scratchpad__done">{labels.scratchpadCommitted}</span>}
          {pad.targets.map((t, i) => (
            <button
              key={t.key ?? 'default'}
              type="button"
              className={cx('cal-btn', i === 0 && 'cal-btn--primary', classNames.button, i === 0 && classNames.buttonPrimary)}
              onClick={() => void pad.commit(t.key)}
              disabled={pad.committing || pad.text.trim() === ''}
            >
              {pad.committing ? labels.scratchpadCommitting : t.label ?? labels.scratchpadCommit}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
