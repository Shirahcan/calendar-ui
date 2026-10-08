import { useEffect, useId, useRef, useState } from 'react';
import { cx, useCalendarUi } from '../theme';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** Destructive: listed last, after a separator, in the danger colour. */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * A row's actions behind one kebab (⋮) button: the one place a list row offers two or more things
 * to do, so rows stay quiet and every product's lists behave the same. Destructive items go last.
 */
export function RowMenu({ label, items, disabled }: { label: string; items: RowMenuItem[]; disabled?: boolean }) {
  const { classNames } = useCalendarUi();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const ordered = [...items.filter((i) => !i.danger), ...items.filter((i) => i.danger)];
  const firstDanger = ordered.findIndex((i) => i.danger);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <span className="cal-rowmenu" ref={root}>
      <button
        type="button"
        className={cx('cal-rowmenu__trigger', classNames.button)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open ? (
        <div className="cal-rowmenu__list" role="menu" id={id} ref={menu}>
          {ordered.map((item, i) => (
            <span key={item.label}>
              {i === firstDanger && i > 0 ? <span className="cal-rowmenu__sep" role="separator" /> : null}
              <button
                type="button"
                role="menuitem"
                className={cx('cal-rowmenu__item', item.danger && 'cal-rowmenu__item--danger')}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </span>
  );
}
