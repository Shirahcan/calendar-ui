import { useCallback, useEffect, useRef, useState } from 'react';
import { useMeetingScratchpad, type ScratchpadAdapter } from '../hooks/useMeetingScratchpad';
import { cx, useCalendarUi } from '../theme';
import { formatZonedDateTime } from '../zoned';
import { MeetingScratchpad } from './MeetingScratchpad';

/**
 * Call pads the person has not filed or discarded (plan N4). Leaving a call never stops to ask
 * about the pad; instead it surfaces where they work (a dashboard, the case, the meeting page)
 * until they settle it (owner 2026-10-09: until filed or discarded).
 */
export interface PendingPad {
  meeting_id: string;
  title: string;
  href: string;
  content: string;
  updated_at: string | null;
  start_utc?: string | null;
  case_id?: string | null;
  case_title?: string | null;
}

export interface PendingPadsAdapter {
  list: () => Promise<PendingPad[]>;
  /** The pad's own adapter (load, autosave, file, discard, actions): usually kitScratchpadAdapter. */
  padFor: (pad: PendingPad) => ScratchpadAdapter;
}

export function usePendingPads(adapter: PendingPadsAdapter, filter?: (pad: PendingPad) => boolean) {
  const [pads, setPads] = useState<PendingPad[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef({ adapter, filter });

  useEffect(() => {
    ref.current = { adapter, filter };
  });

  const reload = useCallback(async () => {
    try {
      const list = await ref.current.adapter.list();
      setPads(ref.current.filter ? list.filter(ref.current.filter) : list);
    } catch {
      // A banner that cannot load stays quiet: the pads are still on each meeting page.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { pads, loaded, reload };
}

export interface PendingPadsBannerProps {
  adapter: PendingPadsAdapter;
  /** Only these pads (a case page shows that case's). */
  filter?: (pad: PendingPad) => boolean;
  timezone: string;
  /** How the product opens a meeting (a router push); defaults to following `href`. */
  onOpenMeeting?: (pad: PendingPad) => void;
  /** Ask before discarding (the product's own dialog); defaults to window.confirm. */
  confirmDiscard?: (question: string) => Promise<boolean>;
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 *   ⓘ You have call notes that are not saved anywhere yet
 *     Review them and save them where they belong, or discard them.
 *     Study permit review · Oct 11, 3:00 PM            [Review]
 */
export function PendingPadsBanner({ adapter, filter, timezone, onOpenMeeting, confirmDiscard, describeError, className }: PendingPadsBannerProps) {
  const { labels, classNames } = useCalendarUi();
  const { pads, reload } = usePendingPads(adapter, filter);
  const [open, setOpen] = useState<PendingPad | null>(null);

  if (pads.length === 0 && open === null) return null;

  return (
    <>
      {pads.length > 0 && (
        <section className={cx('cal-pads', classNames.pendingPads, className)} aria-label={labels.pendingPadsTitle(pads.length)}>
          <p className="cal-pads__title">{labels.pendingPadsTitle(pads.length)}</p>
          <p className="cal-pads__hint">{labels.pendingPadsHint}</p>
          <ul className="cal-pads__list">
            {pads.map((pad) => (
              <li key={pad.meeting_id} className="cal-pads__item">
                <span className="cal-pads__name">
                  <span className="cal-pads__meeting">{pad.title}</span>
                  {pad.start_utc && <span className="cal-pads__when">{formatZonedDateTime(pad.start_utc, timezone)}</span>}
                  <span className="cal-pads__preview">{pad.content}</span>
                </span>
                <button type="button" className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)} onClick={() => setOpen(pad)}>
                  {labels.pendingPadsReview}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {open && (
        <PadReviewDialog
          pad={open}
          adapter={adapter.padFor(open)}
          onClose={() => {
            setOpen(null);
            void reload();
          }}
          onOpenMeeting={onOpenMeeting}
          confirmDiscard={confirmDiscard}
          describeError={describeError}
        />
      )}
    </>
  );
}

export interface PadReviewDialogProps {
  pad: PendingPad;
  adapter: ScratchpadAdapter;
  onClose: () => void;
  onOpenMeeting?: (pad: PendingPad) => void;
  confirmDiscard?: (question: string) => Promise<boolean>;
  describeError?: (error: unknown) => string;
}

/** One pad, viewport-bounded with a scrolling body: edit, file it, run an action, or discard it. */
export function PadReviewDialog({ pad, adapter, onClose, onOpenMeeting, confirmDiscard, describeError }: PadReviewDialogProps) {
  const { labels, classNames } = useCalendarUi();
  const dialog = useRef<HTMLDialogElement>(null);
  const scratchpad = useMeetingScratchpad(adapter);
  const ask = confirmDiscard ?? (async (q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open && typeof d.showModal === 'function') d.showModal();
  }, []);

  // Filed: nothing left to review.
  useEffect(() => {
    if (scratchpad.commits > 0 && scratchpad.text === '') onClose();
  }, [scratchpad.commits, scratchpad.text, onClose]);

  const discard = async () => {
    if ((await ask(labels.padReviewDiscardAsk)) && (await scratchpad.discard())) onClose();
  };

  return (
    <dialog
      ref={dialog}
      className={cx('cal-paddlg', classNames.padReview)}
      aria-label={labels.padReviewTitle(pad.title)}
      onCancel={(e) => {
        e.preventDefault();
        void scratchpad.flush().then(onClose);
      }}
    >
      <header className="cal-paddlg__head">
        <h3>{labels.padReviewTitle(pad.title)}</h3>
        <button type="button" className="cal-paddlg__close" aria-label={labels.padReviewClose} onClick={() => void scratchpad.flush().then(onClose)}>×</button>
      </header>
      <div className="cal-paddlg__body">
        <MeetingScratchpad scratchpad={scratchpad} describeError={describeError} />
      </div>
      <footer className="cal-paddlg__foot">
        <button type="button" className={cx('cal-btn', 'cal-btn--danger', classNames.button)} onClick={() => void discard()}>
          {labels.padReviewDiscard}
        </button>
        <button
          type="button"
          className={cx('cal-btn', classNames.button)}
          onClick={() => void scratchpad.flush().then(() => (onOpenMeeting ? onOpenMeeting(pad) : window.location.assign(pad.href)))}
        >
          {labels.padReviewOpenMeeting}
        </button>
      </footer>
    </dialog>
  );
}
