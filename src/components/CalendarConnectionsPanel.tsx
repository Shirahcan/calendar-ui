import { useCallback, useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { RowMenu } from './RowMenu';
import { errorText } from '../errorText';

export type CalendarProvider = 'google' | 'microsoft';

/** A person's calendar connection as calendar-service reports it (never a token). */
export interface CalendarConnection {
  id: number;
  provider: CalendarProvider;
  account_email: string | null;
  status: 'active' | 'needs_reauth';
  busy_calendars: string[];
  write_calendar: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  reconnect_recommended?: boolean;
}

/** The product's own backend, which calls calendar-service (the package never calls the service). */
export interface CalendarConnectionsAdapter {
  list: () => Promise<CalendarConnection[]>;
  /**
   * Start connecting: the product asks the service for the provider's consent URL and sends the
   * person there (a redirect or a popup, the product's choice). Resolves once that has started.
   */
  connect: (provider: CalendarProvider) => Promise<void>;
  disconnect: (id: number) => Promise<void>;
}

export interface CalendarConnectionsPanelProps {
  adapter: CalendarConnectionsAdapter;
  /** Which providers to offer. */
  providers?: CalendarProvider[];
  /** Ask before disconnecting (a product's own dialog); defaults to window.confirm. */
  confirmDisconnect?: (connection: CalendarConnection, question: string) => Promise<boolean>;
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * A person's connected calendars, the same in every product: the connection belongs to the person
 * (calendar-service), so connecting Google once here serves every product they use. Busy time on a
 * connected calendar keeps them from being double-booked.
 */
export function CalendarConnectionsPanel({ adapter, providers = ['google', 'microsoft'], confirmDisconnect, describeError, className }: CalendarConnectionsPanelProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [rows, setRows] = useState<CalendarConnection[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.connFailed));
  const ask = confirmDisconnect ?? (async (_c: CalendarConnection, q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

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

  const disconnect = (c: CalendarConnection) => act(async () => {
    if (await ask(c, labels.connConfirmDisconnect(labels.connProvider(c.provider), c.account_email))) {
      await adapter.disconnect(c.id);
      await reload();
    }
  });

  const btn = cx('cal-btn', classNames.button);
  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);

  return (
    <section className={cx('cal-conns', classNames.connectionsPanel, className)} aria-labelledby={`${ids}-t`}>
      <h3 className="cal-conns__title" id={`${ids}-t`}>{labels.connTitle}</h3>
      <p className="cal-conns__intro">{labels.connIntro}</p>
      {error ? <p className="cal-conns__error" role="alert">{describe(error)}</p> : null}
      {rows === null && !error ? <p className="cal-conns__note">{labels.connLoading}</p> : null}

      {rows !== null ? (
        rows.length === 0 ? <p className="cal-conns__note">{labels.connNone}</p> : (
          <ul className="cal-conns__list">
            {rows.map((c) => (
              <li key={c.id} className={cx('cal-conns__item', c.status === 'needs_reauth' && 'cal-conns__item--warn')}>
                <span className="cal-conns__provider">{labels.connProvider(c.provider)}</span>
                <span className="cal-conns__account">{c.account_email ?? labels.connNoEmail}</span>
                <span className="cal-conns__status">
                  {c.status === 'needs_reauth'
                    ? labels.connNeedsReauth
                    : c.last_synced_at ? labels.connSynced(c.last_synced_at) : labels.connNotSyncedYet}
                </span>
                {c.last_error && c.status === 'needs_reauth' ? <span className="cal-conns__why">{c.last_error}</span> : null}
                <span className="cal-conns__actions">
                  {c.status === 'needs_reauth' || c.reconnect_recommended ? (
                    <RowMenu
                      label={labels.connActionsFor(labels.connProvider(c.provider))}
                      disabled={busy}
                      items={[
                        { label: labels.connReconnect, onSelect: () => void act(() => adapter.connect(c.provider)) },
                        { label: labels.connDisconnect, danger: true, onSelect: () => void disconnect(c) },
                      ]}
                    />
                  ) : (
                    <button type="button" className={btn} disabled={busy} onClick={() => void disconnect(c)}>{labels.connDisconnect}</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <div className="cal-conns__add">
        {providers.map((p) => (
          <button key={p} type="button" className={primary} disabled={busy} onClick={() => void act(() => adapter.connect(p))}>
            {labels.connConnect(labels.connProvider(p))}
          </button>
        ))}
      </div>
    </section>
  );
}
