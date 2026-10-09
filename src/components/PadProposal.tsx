import type { MeetingScratchpadState } from '../hooks/useMeetingScratchpad';
import { cx, useCalendarUi } from '../theme';

/**
 * A pad action's proposal beside the person's own text (owner 2026-10-09: preview, then accept).
 * Nothing they wrote changes until they choose "Use this version"; "Keep mine" drops the proposal.
 *
 *   Clean up with Porter
 *   Your notes            | Suggested
 *   [their text]          | [proposed text]
 *                [Keep mine] [Use this version]
 */
export function PadProposal({ scratchpad: pad, className }: { scratchpad: MeetingScratchpadState; className?: string }) {
  const { labels, classNames } = useCalendarUi();
  const p = pad.proposal;
  if (!p) return null;

  return (
    <section className={cx('cal-proposal', classNames.proposal, className)} aria-label={labels.proposalTitle(p.label)}>
      <p className="cal-proposal__title">{labels.proposalTitle(p.label)}</p>
      <div className="cal-proposal__cols">
        <div className="cal-proposal__col">
          <p className="cal-proposal__label">{labels.proposalYours}</p>
          <div className="cal-proposal__text">{pad.text}</div>
        </div>
        <div className="cal-proposal__col cal-proposal__col--theirs">
          <p className="cal-proposal__label">{labels.proposalTheirs}</p>
          <div className="cal-proposal__text">{p.text}</div>
        </div>
      </div>
      <div className="cal-proposal__actions">
        <button type="button" className={cx('cal-btn', classNames.button)} onClick={pad.dismissProposal}>
          {labels.proposalDismiss}
        </button>
        <button type="button" className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)} onClick={() => void pad.acceptProposal()}>
          {labels.proposalAccept}
        </button>
      </div>
    </section>
  );
}

/** The product's actions on the pad's text, as buttons ("Clean up with Porter"). */
export function PadActions({ scratchpad: pad }: { scratchpad: MeetingScratchpadState }) {
  const { labels, classNames } = useCalendarUi();
  if (pad.actions.length === 0) return null;

  return (
    <div className="cal-scratchpad__tools">
      {pad.actions.map((a) => (
        <button
          key={a.key}
          type="button"
          className={cx('cal-btn', 'cal-btn--quiet', classNames.button)}
          onClick={() => void pad.propose(a.key)}
          disabled={pad.proposing !== null || pad.text.trim() === '' || pad.proposal !== null}
        >
          {pad.proposing === a.key ? labels.proposalWorking : a.label}
        </button>
      ))}
    </div>
  );
}
