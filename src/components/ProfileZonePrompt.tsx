import type { ProfileZonePrompt as Prompt } from '../hooks/useProfileZonePrompt';
import { zoneCity, zoneLabel } from '../zoned';

export interface ProfileZonePromptProps {
  /** From useProfileZonePrompt. Renders nothing unless there is a question or an answer to show. */
  prompt: Prompt;
  /** The product's way of turning a save failure into a sentence; defaults to the error's message. */
  describeError?: (error: unknown) => string;
  className?: string;
}

const describe = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'Your profile could not be updated. Please try again.';

/**
 * The question, after a booking made on a clock other than the profile's:
 *
 *   Emails use Toronto time (EDT)
 *   You booked on Lagos time. Your emails and calendar invites use the timezone on your
 *   profile. Switch them to Lagos time?
 *   [Keep Toronto time] [Use Lagos time]
 */
export function ProfileZonePrompt({ prompt, describeError = describe, className }: ProfileZonePromptProps) {
  if (!prompt.visible || !prompt.profileZone) return null;

  const now = Date.now();
  const booked = `${zoneCity(prompt.bookedZone)} time`;
  const profile = `${zoneCity(prompt.profileZone)} time`;

  if (prompt.status === 'saved') {
    return (
      <p className={`cal-zoneprompt cal-zoneprompt--done ${className ?? ''}`} role="status">
        Done. Your emails and calendar invites now use {booked} ({zoneLabel(now, prompt.bookedZone)}).
      </p>
    );
  }

  return (
    <section className={`cal-zoneprompt ${className ?? ''}`} aria-label="Timezone for your emails">
      <p className="cal-zoneprompt__title">
        Your emails use {profile} ({zoneLabel(now, prompt.profileZone)})
      </p>
      <p className="cal-zoneprompt__body">
        You booked on {booked} ({zoneLabel(now, prompt.bookedZone)}). Your emails and calendar invites use the
        timezone on your profile. Switch them to {booked}?
      </p>
      {prompt.error != null && <p className="cal-zoneprompt__error" role="alert">{describeError(prompt.error)}</p>}
      <div className="cal-zoneprompt__actions">
        <button type="button" className="cal-btn" onClick={prompt.decline} disabled={prompt.status === 'saving'}>
          Keep {profile}
        </button>
        <button type="button" className="cal-btn cal-btn--primary" onClick={() => void prompt.accept()} disabled={prompt.status === 'saving'}>
          {prompt.status === 'saving' ? 'Saving…' : `Use ${booked}`}
        </button>
      </div>
    </section>
  );
}
