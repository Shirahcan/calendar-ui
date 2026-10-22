import { useEffect, useRef, type ReactNode } from 'react';
import { cx, useCalendarUi } from '../theme';

/**
 * One modal shell for the kit (meeting dialogs, hours for a set time): a native modal bounded to the viewport, header and
 * footer pinned, the body scrolls. Mounted = open, like PadReviewDialog; Escape and × close it.
 */
export function ModalShell({ title, onClose, headSide, footer, children, className }: {
  title: string;
  onClose: () => void;
  headSide?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { labels } = useCalendarUi();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open && typeof d.showModal === 'function') d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={cx('cal-modal', className)}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="cal-modal__head">
        <h3>{title}</h3>
        <span className="cal-modal__headside">
          {headSide}
          <button type="button" className="cal-modal__close" aria-label={labels.quickViewClose} onClick={onClose}>×</button>
        </span>
      </header>
      <div className="cal-modal__body">{children}</div>
      {footer ? <footer className="cal-modal__foot">{footer}</footer> : null}
    </dialog>
  );
}
