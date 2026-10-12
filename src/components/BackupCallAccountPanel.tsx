import { useCallback, useEffect, useId, useState } from 'react';
import { cx, useCalendarUi } from '../theme';
import { RowMenu } from './RowMenu';
import { errorText } from '../errorText';

/** The product's backup call account as calendar-service reports it (GET /v1/backup-account; never a token). */
export interface BackupCallAccount {
  id: number;
  provider: 'google';
  account_email: string | null;
  status: 'active' | 'needs_reauth';
  last_error: string | null;
}

/** The product's own backend, which calls calendar-service (the package never calls the service). */
export interface BackupCallAccountAdapter {
  /** The account, or null when none is connected. */
  load: () => Promise<BackupCallAccount | null>;
  /** Start connecting: the product asks for Google's consent URL and sends the admin there. */
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export interface BackupCallAccountPanelProps {
  adapter: BackupCallAccountAdapter;
  /** Ask before disconnecting (a product's own dialog); defaults to window.confirm. */
  confirmDisconnect?: (account: BackupCallAccount, question: string) => Promise<boolean>;
  describeError?: (error: unknown) => string;
  /** Bump to reload (e.g. after the admin comes back from Google). */
  refreshKey?: number;
  className?: string;
}

/**
 * The product's own Google account that makes a backup Google Meet when a call's room cannot be
 * rescued, for its admins: connect, reconnect, disconnect. One account per product; connecting
 * another replaces it. The account must let guests in without a host (Workspace Meet access
 * "Open"), and the panel says so, because nobody from the product sits in a backup meeting.
 */
export function BackupCallAccountPanel({ adapter, confirmDisconnect, describeError, refreshKey = 0, className }: BackupCallAccountPanelProps) {
  const { labels, classNames } = useCalendarUi();
  const ids = useId();
  const [account, setAccount] = useState<BackupCallAccount | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const describe = describeError ?? ((e: unknown) => errorText(e, labels.backupFailed));
  const ask = confirmDisconnect ?? (async (_a: BackupCallAccount, q: string) => (typeof window === 'undefined' ? false : window.confirm(q)));

  const reload = useCallback(async () => {
    try {
      setAccount(await adapter.load());
    } catch (e) {
      setError(e);
    }
  }, [adapter]);

  useEffect(() => {
    let live = true;
    adapter.load().then((a) => live && setAccount(a)).catch((e) => live && setError(e));
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

  const disconnect = (a: BackupCallAccount) => act(async () => {
    if (await ask(a, labels.backupConfirmDisconnect(a.account_email))) {
      await adapter.disconnect();
      await reload();
    }
  });

  const btn = cx('cal-btn', classNames.button);
  const primary = cx('cal-btn cal-btn--primary', classNames.button, classNames.buttonPrimary);

  return (
    <section className={cx('cal-conns', classNames.backupAccountPanel, className)} aria-labelledby={`${ids}-t`}>
      <h3 className="cal-conns__title" id={`${ids}-t`}>{labels.backupTitle}</h3>
      <p className="cal-conns__intro">{labels.backupIntro}</p>
      <p className="cal-conns__notice">{labels.backupOpenAccess}</p>
      {error ? <p className="cal-conns__error" role="alert">{describe(error)}</p> : null}
      {account === undefined && !error ? <p className="cal-conns__note">{labels.backupLoading}</p> : null}

      {account === null ? (
        <>
          <p className="cal-conns__note">{labels.backupNone}</p>
          <div className="cal-conns__add">
            <button type="button" className={primary} disabled={busy} onClick={() => void act(() => adapter.connect())}>{labels.backupConnect}</button>
          </div>
        </>
      ) : null}

      {account ? (
        <ul className="cal-conns__list">
          <li className={cx('cal-conns__item', account.status === 'needs_reauth' && 'cal-conns__item--warn')}>
            <span className="cal-conns__provider">{labels.policyCallTool('google_meet')}</span>
            <span className="cal-conns__account">{account.account_email ?? labels.connNoEmail}</span>
            <span className="cal-conns__status">{account.status === 'needs_reauth' ? labels.backupNeedsReauth : labels.backupActive}</span>
            <span className="cal-conns__actions">
              <RowMenu
                label={labels.backupActionsFor(account.account_email ?? labels.backupTitle)}
                disabled={busy}
                items={[
                  { label: labels.backupReconnect, onSelect: () => void act(() => adapter.connect()) },
                  { label: labels.backupDisconnect, danger: true, onSelect: () => void disconnect(account) },
                ]}
              />
            </span>
          </li>
          {account.last_error && account.status === 'needs_reauth' ? <li className="cal-conns__why">{account.last_error}</li> : null}
        </ul>
      ) : null}
      {account && account.status === 'needs_reauth' ? (
        <div className="cal-conns__add">
          <button type="button" className={btn} disabled={busy} onClick={() => void act(() => adapter.connect())}>{labels.backupReconnect}</button>
        </div>
      ) : null}
    </section>
  );
}
