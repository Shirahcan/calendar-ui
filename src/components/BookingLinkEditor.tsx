import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';

/** A host's booking link as calendar-service reads it back (calendar-client `links()`). */
export interface BookingLink {
  ref: string;
  host: string;
  name: string;
  description: string | null;
  color: string | null;
  slug: string;
  is_active: boolean;
  is_default: boolean;
  external_url: string | null;
  duration: number | null;
  /** null = the host's usual buffer applies. */
  buffer_before: number | null;
  buffer_after: number | null;
  /** null = no daily limit. */
  daily_cap: number | null;
  /** null = the product's usual horizon applies. */
  days_ahead: number | null;
}

/** What a create or an edit sends (only the keys given change on an edit). */
export interface BookingLinkFields {
  name: string;
  duration: number;
  description: string | null;
  color: string | null;
  slug: string | null;
  is_active: boolean;
  is_default: boolean;
  buffer_before: number | null;
  buffer_after: number | null;
  daily_cap: number | null;
  days_ahead: number | null;
}

/** The limits a person may choose: the product's scheduling policy, never constants. */
export interface BookingLinkLimits {
  durations: number[];
  minBuffer: number;
  maxBuffer: number;
  maxDaysAhead: number;
  maxDailyCap?: number;
}

export interface BookingLinkEditorProps {
  open: boolean;
  /** null = creating a new link. */
  link: BookingLink | null;
  limits: BookingLinkLimits;
  onSave: (fields: BookingLinkFields) => Promise<void>;
  onClose: () => void;
  describeError?: (error: unknown) => string;
}

const intOrNull = (v: string): number | null => (v.trim() === '' ? null : Math.max(0, Math.trunc(Number(v))));

/**
 * Create or edit one booking link, the same in every product. A native modal dialog that stays
 * inside the viewport: its header and footer stay put and the fields scroll between them, so the
 * Save button is reachable on a short screen. Limits come from the product's policy; a refusal shows
 * every reason the service gave, so the person can fix it.
 */
export function BookingLinkEditor({ open, link, limits, onSave, onClose, describeError }: BookingLinkEditorProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(() => toForm(link, limits));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.linkSaveFailed));

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    if (!open && d.open) d.close();
  }, [open]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: form.name.trim(),
        duration: Number(form.duration),
        description: form.description.trim() || null,
        color: form.color || null,
        slug: form.slug.trim() || null,
        is_active: form.is_active,
        is_default: form.is_default,
        buffer_before: intOrNull(form.buffer_before),
        buffer_after: intOrNull(form.buffer_after),
        daily_cap: intOrNull(form.daily_cap),
        days_ahead: intOrNull(form.days_ahead),
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const field = cx('cal-input', classNames.input);
  const btn = cx('cal-btn', classNames.button);
  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);

  return (
    <dialog ref={dialog} className={cx('cal-linkdlg', classNames.linkEditor)} aria-labelledby={`${ids}-t`} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {open ? (
        <form className="cal-linkdlg__form" onSubmit={(e) => void submit(e)}>
          <header className="cal-linkdlg__head">
            <h3 id={`${ids}-t`}>{link ? labels.linkEditTitle : labels.linkCreateTitle}</h3>
            <button type="button" className="cal-linkdlg__close" aria-label={labels.linkClose} onClick={onClose}>×</button>
          </header>
          <div className="cal-linkdlg__body">
            {error ? <p className="cal-links__error" role="alert">{describe(error)}</p> : null}
            <label className="cal-links__field">{labels.linkName}
              <input className={field} required maxLength={255} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="cal-links__field">{labels.linkSlug}
              <input className={field} value={form.slug} placeholder={labels.linkSlugPlaceholder} onChange={(e) => set({ slug: e.target.value })} />
              <span className="cal-links__hint">{labels.linkSlugHelp}</span>
            </label>
            <label className="cal-links__field">{labels.linkDescription}
              <textarea className={field} rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </label>
            <div className="cal-links__row">
              <label className="cal-links__field">{labels.linkDuration}
                <select className={field} value={form.duration} onChange={(e) => set({ duration: e.target.value })}>
                  {limits.durations.map((m) => <option key={m} value={m}>{labels.availMinutes(m)}</option>)}
                </select>
              </label>
              <label className="cal-links__field">{labels.linkColor}
                <input className={cx(field, 'cal-links__color')} type="color" value={form.color || '#3b82f6'} onChange={(e) => set({ color: e.target.value })} />
              </label>
            </div>
            <div className="cal-links__row">
              <label className="cal-links__field">{labels.linkBufferBefore}
                <input className={field} type="number" min={0} max={limits.maxBuffer} value={form.buffer_before} placeholder={labels.linkUsual} onChange={(e) => set({ buffer_before: e.target.value })} />
              </label>
              <label className="cal-links__field">{labels.linkBufferAfter}
                <input className={field} type="number" min={0} max={limits.maxBuffer} value={form.buffer_after} placeholder={labels.linkUsual} onChange={(e) => set({ buffer_after: e.target.value })} />
              </label>
            </div>
            <span className="cal-links__hint">{labels.linkBufferHelp(limits.minBuffer, limits.maxBuffer)}</span>
            <div className="cal-links__row">
              <label className="cal-links__field">{labels.linkDaysAhead}
                <input className={field} type="number" min={1} max={limits.maxDaysAhead} value={form.days_ahead} placeholder={labels.linkUsual} onChange={(e) => set({ days_ahead: e.target.value })} />
              </label>
              <label className="cal-links__field">{labels.linkDailyCap}
                <input className={field} type="number" min={1} max={limits.maxDailyCap ?? 50} value={form.daily_cap} placeholder={labels.linkUnlimited} onChange={(e) => set({ daily_cap: e.target.value })} />
              </label>
            </div>
            <label className="cal-links__check">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} /> {labels.linkActive}
            </label>
            <label className="cal-links__check">
              <input type="checkbox" checked={form.is_default} onChange={(e) => set({ is_default: e.target.checked })} /> {labels.linkDefault}
            </label>
          </div>
          <footer className="cal-linkdlg__foot">
            <button type="button" className={btn} onClick={onClose} disabled={busy}>{labels.linkCancel}</button>
            <button type="submit" className={primary} disabled={busy || form.name.trim() === ''}>{link ? labels.linkSave : labels.linkCreate}</button>
          </footer>
        </form>
      ) : null}
    </dialog>
  );
}

function toForm(link: BookingLink | null, limits: BookingLinkLimits) {
  const s = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

  return {
    name: link?.name ?? '',
    slug: link?.slug ?? '',
    description: link?.description ?? '',
    duration: String(link?.duration ?? limits.durations[0] ?? ''),
    color: link?.color ?? '',
    buffer_before: s(link?.buffer_before),
    buffer_after: s(link?.buffer_after),
    days_ahead: s(link?.days_ahead),
    daily_cap: s(link?.daily_cap),
    is_active: link?.is_active ?? true,
    is_default: link?.is_default ?? false,
  };
}
