import { useSyncExternalStore } from 'react';

/**
 * The ONE answer, in every product, to "which clock does this screen show times in?".
 *
 * Estate rule (2026-10-04): on the platform, the clock of the device the person is using right
 * now; emails and calendar files use the profile zone (server side). The viewer may pick another
 * zone with a "Show times in" control; that choice lives in this browser only and NEVER writes a
 * profile. (A selector that wrote the profile once also rewrote a consultant's scheduling zone,
 * moving their bookable hours because they changed how a screen reads.)
 */

const STORAGE_KEY = 'shirah.display-timezone';
const CHANGE_EVENT = 'shirah:display-timezone';

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function isZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });

    return true;
  } catch {
    return false;
  }
}

function readPicked(): string | null {
  try {
    const tz = window.localStorage.getItem(STORAGE_KEY);

    return tz && isZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/** Show times in `zone` on this browser. The device's own zone, or null, clears the choice. */
export function setDisplayTimezone(zone: string | null): void {
  try {
    if (!zone || zone === deviceTimezone()) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, zone);
    }
  } catch {
    // Storage blocked (private mode): the choice simply does not stick.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export interface DisplayTimezone {
  /** The zone the screen renders in. Always a non-empty IANA id. */
  timezone: string;
  /** The device's own zone, for a "Use detected" shortcut. */
  deviceTimezone: string;
  /** True when the viewer picked a zone other than the device's. */
  isPicked: boolean;
}

export function useDisplayTimezone(): DisplayTimezone {
  const picked = useSyncExternalStore(subscribe, readPicked, () => null);
  const device = deviceTimezone();

  return { timezone: picked ?? device, deviceTimezone: device, isPicked: picked !== null };
}
