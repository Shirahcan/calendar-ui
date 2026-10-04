import { useCallback, useState, useSyncExternalStore } from 'react';
import { sameClock } from '../zoned';

/**
 * "You booked on Lagos time; your emails use Toronto time. Switch them?"
 *
 * Estate rule (owner, 2026-10-04): screens show the device's clock (or a zone picked with "Show
 * times in"), while emails and calendar files use the PROFILE zone. When someone books on a
 * clock that differs from their profile, we ASK whether their emails should follow; we never
 * change a profile on their behalf. Saying no is remembered on this browser for that pair of
 * zones, so the same question is not asked after every booking.
 *
 * The product supplies `save` (its own profile endpoint); this hook decides WHEN to ask.
 */

const DECLINED_KEY = 'shirah.profile-zone-declined';
const CHANGE_EVENT = 'shirah:profile-zone-declined';

function isZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });

    return true;
  } catch {
    return false;
  }
}

function readDeclined(): string {
  try {
    return window.localStorage.getItem(DECLINED_KEY) ?? '';
  } catch {
    return '';
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const pairKey = (profile: string, booked: string) => `${profile}>${booked}`;

export interface ProfileZonePromptOptions {
  /** The zone on the person's profile (what their emails use). Null/unknown: never ask. */
  profileZone: string | null | undefined;
  /** The zone they just booked on (the screen's clock). */
  bookedZone: string;
  /** Writes `zone` to their profile. Throw to report failure. */
  save: (zone: string) => Promise<void>;
}

export type ProfileZonePromptStatus = 'ask' | 'saving' | 'saved' | 'declined' | 'hidden';

export interface ProfileZonePrompt {
  status: ProfileZonePromptStatus;
  /** True while there is something to show (asking, saving, or the "done" line). */
  visible: boolean;
  profileZone: string | null;
  bookedZone: string;
  /** The error `save` threw, if the last attempt failed. */
  error: unknown;
  accept: () => Promise<void>;
  decline: () => void;
}

export function useProfileZonePrompt({ profileZone, bookedZone, save }: ProfileZonePromptOptions): ProfileZonePrompt {
  const declined = useSyncExternalStore(subscribe, readDeclined, () => '');
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<unknown>(null);

  const differs = isZone(profileZone) && isZone(bookedZone) && !sameClock(profileZone, bookedZone);
  const wasDeclined = differs && declined === pairKey(profileZone, bookedZone);

  let status: ProfileZonePromptStatus = 'hidden';
  if (phase === 'saved') status = 'saved';
  else if (phase === 'saving') status = 'saving';
  else if (wasDeclined) status = 'declined';
  else if (differs) status = 'ask';

  const accept = useCallback(async () => {
    setPhase('saving');
    setError(null);
    try {
      await save(bookedZone);
      setPhase('saved');
    } catch (e) {
      setError(e);
      setPhase('idle');
    }
  }, [save, bookedZone]);

  const decline = useCallback(() => {
    if (!isZone(profileZone)) return;
    try {
      window.localStorage.setItem(DECLINED_KEY, pairKey(profileZone, bookedZone));
    } catch {
      // Storage blocked: the question may come back next time, which is harmless.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [profileZone, bookedZone]);

  return {
    status,
    visible: status === 'ask' || status === 'saving' || status === 'saved',
    profileZone: isZone(profileZone) ? profileZone : null,
    bookedZone,
    error,
    accept,
    decline,
  };
}
