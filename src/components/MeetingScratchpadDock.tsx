import { useEffect, useId, useRef, useState } from 'react';
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
 * Opening slides the panel in from the edge with the tab riding on it, and closing slides it
 * back out (none under prefers-reduced-motion). The closed panel stays mounted but hidden from
 * assistive tech and the tab order. Opening puts the cursor in the pad; closing saves whatever
 * is unsaved and hands focus back to the tab. Escape closes it. The panel is bounded by the
 * viewport and scrolls inside, so its button stays reachable on a short screen. Position it
 * with the `--cal-dock-top` and `--cal-dock-bottom` variables, and size it with
 * `--cal-dock-width`.
 */
export function MeetingScratchpadDock({ scratchpad, defaultOpen = false, describeError, className }: MeetingScratchpadDockProps) {
  const { labels, classNames } = useCalendarUi();
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const tabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { flush } = scratchpad;

  const show = () => {
    setOpen(true);
    // After the commit that makes the panel focusable again.
    requestAnimationFrame(() => panelRef.current?.querySelector('textarea')?.focus({ preventScroll: true }));
  };

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
        tabRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flush]);

  const unsaved = scratchpad.status === 'unsaved' || scratchpad.status === 'error';

  return (
    <div className={cx('cal-dock', open && 'cal-dock--open', classNames.scratchpadDock, className)}>
      <div className="cal-dock__slide">
        <button
          ref={tabRef}
          type="button"
          className="cal-dock__tab"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => (open ? close() : show())}
        >
          {open ? labels.scratchpadHide : labels.scratchpadShow}
          {!open && scratchpad.text.trim() !== '' && <span className="cal-dock__dot" aria-label={unsaved ? labels.scratchpadUnsaved : labels.scratchpadHasText} />}
        </button>
        <div ref={panelRef} id={panelId} className="cal-dock__panel" aria-hidden={!open} inert={!open}>
          <MeetingScratchpad scratchpad={scratchpad} describeError={describeError} />
        </div>
      </div>
    </div>
  );
}
