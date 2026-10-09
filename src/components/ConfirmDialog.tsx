import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx, useCalendarUi } from '../theme';

/**
 * A yes/no question as a native modal dialog. Use it for a confirm asked from INSIDE another
 * native modal (PadReviewDialog): a modal makes everything outside it inert, so a product's own
 * portal-based dialog could not be clicked there. A nested native modal stacks above it.
 *
 *   const [confirmEl, ask] = useConfirm();
 *   if (await ask('Discard these notes?', 'Discard')) …
 *   return <>{…}{confirmEl}</>;
 */
export function useConfirm(): [ReactNode, (question: string, yes: string) => Promise<boolean>] {
  const [pending, setPending] = useState<{ question: string; yes: string; resolve: (ok: boolean) => void } | null>(null);

  const ask = useCallback((question: string, yes: string) => new Promise<boolean>((resolve) => setPending({ question, yes, resolve })), []);
  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return [pending ? <ConfirmDialog key={pending.question} question={pending.question} yes={pending.yes} onAnswer={answer} /> : null, ask];
}

function ConfirmDialog({ question, yes, onAnswer }: { question: string; yes: string; onAnswer: (ok: boolean) => void }) {
  const { labels, classNames } = useCalendarUi();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open && typeof d.showModal === 'function') d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="cal-confirm"
      aria-label={question}
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
    >
      <p className="cal-confirm__question">{question}</p>
      <div className="cal-confirm__actions">
        <button type="button" className={cx('cal-btn', classNames.button)} onClick={() => onAnswer(false)}>
          {labels.notesCancel}
        </button>
        <button type="button" className={cx('cal-btn', 'cal-btn--danger', classNames.button)} onClick={() => onAnswer(true)}>
          {yes}
        </button>
      </div>
    </dialog>
  );
}
