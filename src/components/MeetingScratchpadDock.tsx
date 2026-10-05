import { useEffect, useId, useState } from 'react';
import type { MeetingScratchpadState } from '../hooks/useMeetingScratchpad';
import { cx, useCalendarUi } from '../theme';
import { MeetingScratchpad } from './MeetingScratchpad';

export interface MeetingScratchpadDockProps {
  /** From useMeetingScratchpad. Kept by the caller, so the pad survives being closed. */
  scratchpad: MeetingScratchpadState;
  /** Closed by default (owner 2026-10-05: "docked and hidden by default"). */
  defaultOpen?: boolean;
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * The scratchpad docked to the edge of a meeting room: a tab on the right edge that opens a
 * panel over the room, closed until the person asks for it, so the call keeps the screen.
 *
 * Closing saves whatever is unsaved. Escape closes it. The panel is bounded by the viewport
 * and scrolls inside, so its button stays reachable on a short screen. Position it with the
 * `--cal-dock-top` and `--cal-dock-bottom` variables (defaults clear a product's top bar and
 * its floating buttons).
 */
export function MeetingScratchpadDock({ scratchpad, defaultOpen = false, describeError, className }: MeetingScratchpadDockProps) {
  const { labels, classNames } = useCalendarUi();
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const { flush } = scratchpad;

  const close = () => {
    setOpen(false);
    void flush();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        void flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flush]);

  const unsaved = scratchpad.status === 'unsaved' || scratchpad.status === 'error';

  return (
    <div className={cx('cal-dock', open && 'cal-dock--open', classNames.scratchpadDock, className)}>
      <button
        type="button"
        className="cal-dock__tab"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? labels.scratchpadHide : labels.scratchpadShow}
        {!open && scratchpad.text.trim() !== '' && <span className="cal-dock__dot" aria-label={unsaved ? labels.scratchpadUnsaved : labels.scratchpadHasText} />}
      </button>
      <div id={panelId} className="cal-dock__panel" hidden={!open}>
        <MeetingScratchpad scratchpad={scratchpad} describeError={describeError} />
      </div>
    </div>
  );
}
