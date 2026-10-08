import { useCallback, useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { RowMenu, type RowMenuItem } from './RowMenu';
import { errorText } from '../errorText';
import { BookingLinkEditor, type BookingLink, type BookingLinkFields, type BookingLinkLimits } from './BookingLinkEditor';

/** The product's own backend, which calls calendar-service (the package never calls the service). */
export interface BookingLinksAdapter {
  list: () => Promise<BookingLink[]>;
  create: (fields: BookingLinkFields) => Promise<BookingLink>;
  /** Only the keys given change. */
  update: (ref: string, fields: Partial<BookingLinkFields>) => Promise<BookingLink>;
  setDefault: (ref: string) => Promise<BookingLink>;
  remove: (ref: string) => Promise<void>;
}

/** A product's own row action (e.g. Portify's "Send to client"), listed before the link's own. */
export interface BookingLinkAction {
  label: string;
  onSelect: (link: BookingLink) => void;
  /** Leave it out for some links (e.g. inactive ones). */
  hidden?: (link: BookingLink) => boolean;
}

export interface BookingLinksManagerProps {
  adapter: BookingLinksAdapter;
  limits: BookingLinkLimits;
  /** Product row actions, shown in the same kebab. */
  actions?: BookingLinkAction[];
  /** Ask before deleting (a product's own dialog); defaults to window.confirm. */
  confirmDelete?: (link: BookingLink, question: string) => Promise<boolean>;
  /** Tell the person something worked ("Reference copied"); a product's toast. */
  onNotice?: (message: string) => void;
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * A host's booking links, the same in every product: each is a way to be booked with its own
 * length and rules (calendar-service applies them). One kebab per row (Edit, Copy reference,
 * Switch off/on, Make default, the product's own actions, then Delete behind a confirm). Products
 * that want no UI manage links through calendar-client directly.
 */
export function BookingLinksManager({ adapter, limits, actions = [], confirmDelete, onNotice, describeError, className }: BookingLinksManagerProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [rows, setRows] = useState<BookingLink[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ link: BookingLink | null; n: number } | null>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.linkFailed));
  const ask = confirmDelete ?? (async (_l: BookingLink, q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

  const reload = useCallback(async () => {
    try {
      setRows(await adapter.list());
    } catch (e) {
      setError(e);
    }
  }, [adapter]);

  useEffect(() => {
    let live = true;
    adapter.list().then((r) => live && setRows(r)).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adapter]);

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (link: BookingLink) => {
    try {
      await navigator.clipboard.writeText(link.slug);
      onNotice?.(labels.linkCopied);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(labels.linkCopyFailed));
    }
  };

  const remove = (link: BookingLink) => act(async () => {
    if (await ask(link, labels.linkConfirmDelete(link.name))) {
      await adapter.remove(link.ref);
      onNotice?.(labels.linkDeleted);
    }
  });

  const save = async (fields: BookingLinkFields) => {
    const current = editing?.link ?? null;
    if (current) {
      await adapter.update(current.ref, fields);
      onNotice?.(labels.linkSaved);
    } else {
      await adapter.create(fields);
      onNotice?.(labels.linkCreated);
    }
    setEditing(null);
    await reload();
  };

  const items = (link: BookingLink): RowMenuItem[] => [
    { label: labels.linkEdit, onSelect: () => setEditing({ link, n: Date.now() }) },
    { label: labels.linkCopy, onSelect: () => void copy(link) },
    ...actions.filter((a) => !a.hidden?.(link)).map((a) => ({ label: a.label, onSelect: () => a.onSelect(link) })),
    ...(link.is_default || !link.is_active ? [] : [{ label: labels.linkMakeDefault, onSelect: () => void act(() => adapter.setDefault(link.ref)) }]),
    { label: link.is_active ? labels.linkSwitchOff : labels.linkSwitchOn, onSelect: () => void act(() => adapter.update(link.ref, { is_active: !link.is_active })) },
    { label: labels.linkDelete, danger: true, onSelect: () => void remove(link) },
  ];

  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);

  return (
    <section className={cx('cal-links', classNames.linksManager, className)} aria-labelledby={`${ids}-t`}>
      <div className="cal-links__head">
        <div>
          <h3 className="cal-links__title" id={`${ids}-t`}>{labels.linksTitle}</h3>
          <p className="cal-links__intro">{labels.linksIntro}</p>
        </div>
        <button type="button" className={primary} disabled={busy} onClick={() => setEditing({ link: null, n: Date.now() })}>{labels.linkNew}</button>
      </div>
      {error ? <p className="cal-links__error" role="alert">{describe(error)}</p> : null}
      {rows === null && !error ? <p className="cal-links__note">{labels.linksLoading}</p> : null}
      {rows !== null && rows.length === 0 ? <p className="cal-links__note">{labels.linksNone}</p> : null}
      {rows !== null && rows.length > 0 ? (
        <ul className="cal-links__list">
          {rows.map((link) => (
            <li key={link.ref} className={cx('cal-links__item', !link.is_active && 'cal-links__item--off')}>
              <span className="cal-links__swatch" style={{ background: link.color ?? 'var(--cal-accent)' }} aria-hidden="true" />
              <span className="cal-links__main">
                <span className="cal-links__name">
                  {link.name}
                  {link.is_default ? <span className="cal-links__badge">{labels.linkDefaultBadge}</span> : null}
                  {!link.is_active ? <span className="cal-links__badge cal-links__badge--off">{labels.linkOffBadge}</span> : null}
                </span>
                <span className="cal-links__meta">
                  {link.duration ? labels.availMinutes(link.duration) : null}
                  <span className="cal-links__slug">{link.slug}</span>
                  {link.days_ahead ? <span>{labels.linkDaysAheadShort(link.days_ahead)}</span> : null}
                  {link.daily_cap ? <span>{labels.linkDailyCapShort(link.daily_cap)}</span> : null}
                </span>
              </span>
              <RowMenu label={labels.linkActionsFor(link.name)} disabled={busy} items={items(link)} />
            </li>
          ))}
        </ul>
      ) : null}
      {editing ? (
        <BookingLinkEditor
          key={editing.n}
          open
          link={editing.link}
          limits={limits}
          onSave={save}
          onClose={() => setEditing(null)}
          describeError={describeError}
        />
      ) : null}
    </section>
  );
}
