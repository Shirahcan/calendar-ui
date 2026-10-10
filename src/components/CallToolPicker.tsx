import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { cx, useCalendarUi } from '../theme';
import { errorText } from '../errorText';
import { RowMenu } from './RowMenu';

export type CallToolKind = 'zoom' | 'google_meet';

/** A person's Zoom account as calendar-service reports it (never a token). */
export interface CallToolAccount {
  id: number;
  account_email: string | null;
  status: 'active' | 'needs_reauth';
}

/** The person's call tools, choice and approval preference (all calendar-service's). */
export interface CallToolsState {
  /** null = the product's own video room. */
  choice: CallToolKind | null;
  /** The tools this server offers (the scheduling policy, less any with no app configured). */
  offered: CallToolKind[];
  requires_approval: boolean;
  zoom: CallToolAccount[];
  /** Google Meet runs on the person's Google calendar connection. */
  google_calendar_connected: boolean;
}

/** The product's own backend, which calls calendar-service (the package never calls the service). */
export interface CallToolsAdapter {
  load: () => Promise<CallToolsState>;
  choose: (tool: CallToolKind | null) => Promise<void>;
  /** Start connecting Zoom (a popup or a redirect, the product's choice). Resolves once started. */
  connectZoom: () => Promise<void>;
  disconnectZoom: (id: number) => Promise<void>;
}

export interface CallToolPickerProps {
  adapter: CallToolsAdapter;
  /** Bump to reload (a product's Zoom popup came back). */
  refreshKey?: number;
  /** Where to connect a Google calendar, shown when Meet needs one (a product link). */
  meetCalendarLink?: ReactNode;
  /** Ask before disconnecting (a product's own dialog); defaults to window.confirm. */
  confirmDisconnect?: (account: CallToolAccount, question: string) => Promise<boolean>;
  /** A short success notice (copied, connected...), for the product's toast. */
  onNotice?: (message: string) => void;
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * Which tool runs a person's calls: the product's own room, their Zoom, or Google Meet. The
 * accounts, the choice and the offered list are the person's on calendar-service, so the same in
 * every product. A tool shows when the policy offers it, or while it is in use (so it can be left).
 */
export function CallToolPicker({ adapter, refreshKey = 0, meetCalendarLink, confirmDisconnect, onNotice, describeError, className }: CallToolPickerProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [state, setState] = useState<CallToolsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.callToolFailed));
  const ask = confirmDisconnect ?? (async (_a: CallToolAccount, q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

  const reload = useCallback(async () => setState(await adapter.load()), [adapter]);

  useEffect(() => {
    let live = true;
    adapter.load().then((s) => live && setState(s)).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adapter, refreshKey]);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);
  const plain = cx('cal-btn', classNames.button);
  const choice = state?.choice ?? null;
  const zoom = state?.zoom.find((z) => z.status === 'active') ?? null;
  const offers = (tool: CallToolKind) => !!state && (state.offered.includes(tool) || state.choice === tool);
  const inUse = <span className="cal-tools__inuse">{labels.callToolInUse}</span>;
  const use = (tool: CallToolKind | null) => (
    <button type="button" className={primary} disabled={busy} onClick={() => void act(async () => { await adapter.choose(tool); await reload(); })}>
      {labels.callToolUse}
    </button>
  );

  const row = (key: string, selected: boolean, name: string, hint: ReactNode, side: ReactNode) => (
    <li key={key} className={cx('cal-tools__item', selected && 'is-selected')}>
      <span className="cal-tools__what">
        <span className="cal-tools__name">{name}</span>
        <span className="cal-tools__hint">{hint}</span>
      </span>
      <span className="cal-tools__side">{side}</span>
    </li>
  );

  return (
    <section className={cx('cal-tools', className)} aria-labelledby={`${ids}-t`}>
      <h3 className="cal-tools__title" id={`${ids}-t`}>{labels.callToolsTitle}</h3>
      <p className="cal-tools__intro">{labels.callToolsIntro}</p>
      {error ? <p className="cal-tools__error" role="alert">{describe(error)}</p> : null}
      {state === null && !error ? <p className="cal-tools__intro">{labels.callToolsLoading}</p> : null}

      {state !== null ? (
        <ul className="cal-tools__list">
          {row('room', choice === null, labels.callToolProductRoom, labels.callToolProductRoomHint, choice === null ? inUse : use(null))}

          {(offers('zoom') || zoom) && row('zoom', choice === 'zoom', labels.callToolZoom,
            zoom ? labels.callToolZoomConnectedAs(zoom.account_email) : labels.callToolZoomHint,
            zoom ? (
              <>
                {choice === 'zoom' ? inUse : use('zoom')}
                <RowMenu
                  label={labels.callToolActionsFor(labels.callToolZoom)}
                  disabled={busy}
                  items={[
                    {
                      label: labels.callToolCopyEmail,
                      disabled: !zoom.account_email,
                      onSelect: () => void act(async () => {
                        await navigator.clipboard.writeText(zoom.account_email ?? '');
                        onNotice?.(labels.callToolCopyEmail);
                      }),
                    },
                    {
                      label: labels.callToolDisconnect,
                      danger: true,
                      onSelect: () => void act(async () => {
                        if (await ask(zoom, labels.callToolConfirmDisconnect(zoom.account_email))) {
                          await adapter.disconnectZoom(zoom.id);
                          await reload();
                        }
                      }),
                    },
                  ]}
                />
              </>
            ) : (
              <button type="button" className={plain} disabled={busy} onClick={() => void act(() => adapter.connectZoom())}>{labels.callToolConnect}</button>
            ))}

          {offers('google_meet') && row('meet', choice === 'google_meet', labels.callToolMeet,
            state.google_calendar_connected ? labels.callToolMeetHint : <>{labels.callToolMeetNeedsCalendar} {meetCalendarLink}</>,
            state.google_calendar_connected ? (choice === 'google_meet' ? inUse : use('google_meet')) : null)}
        </ul>
      ) : null}
    </section>
  );
}

export interface BookingApprovalAdapter {
  load: () => Promise<boolean>;
  save: (on: boolean) => Promise<void>;
}

/**
 * Whether a host approves each booking before it is confirmed (their calendar-service host
 * preference). Its own component so a product can offer it to every host, not only those who
 * may choose a call tool.
 */
export function BookingApprovalToggle({ adapter, describeError, className }: { adapter: BookingApprovalAdapter; describeError?: (error: unknown) => string; className?: string }) {
  const { labels } = useCalendarUi();
  const ids = useId();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.callToolFailed));

  useEffect(() => {
    let live = true;
    adapter.load().then((v) => live && setOn(v)).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adapter]);

  const flip = async () => {
    if (on === null) return;
    const next = !on;
    setBusy(true);
    setError(null);
    try {
      await adapter.save(next);
      setOn(next);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cx('cal-tools', 'cal-approval', className)} aria-labelledby={`${ids}-t`}>
      <div className="cal-approval__row">
        <span className="cal-tools__what">
          <span className="cal-tools__name" id={`${ids}-t`}>{labels.approvalTitle}</span>
          <span className="cal-tools__hint" id={`${ids}-h`}>{labels.approvalHint}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on === true}
          aria-labelledby={`${ids}-t`}
          aria-describedby={`${ids}-h`}
          className="cal-switch"
          disabled={on === null || busy}
          onClick={() => void flip()}
        >
          <span className="cal-switch__knob" aria-hidden="true" />
          <span className="cal-switch__text">{on ? labels.approvalOn : labels.approvalOff}</span>
        </button>
      </div>
      {error ? <p className="cal-tools__error" role="alert">{describe(error)}</p> : null}
    </section>
  );
}
