import type { ProfileZonePrompt as Prompt } from '../hooks/useProfileZonePrompt';
import { cx, useCalendarUi } from '../theme';
import { zoneCity, zoneLabel } from '../zoned';

export interface ProfileZonePromptProps {
  /** From useProfileZonePrompt. Renders nothing unless there is a question or an answer to show. */
  prompt: Prompt;
  /** The product's way of turning a save failure into a sentence; defaults to the error's message. */
  describeError?: (error: unknown) => string;
  className?: string;
}

/**
 * The question, after a booking made on a clock other than the profile's:
 *
 *   Emails use Toronto time (EDT)
 *   You booked on Lagos time. Your emails and calendar invites use the timezone on your
 *   profile. Switch them to Lagos time?
 *   [Keep Toronto time] [Use Lagos time]
 *
 * Every sentence comes from the provider's labels, so a product can word it in its own voice.
 */
export function ProfileZonePrompt({ prompt, describeError, className }: ProfileZonePromptProps) {
  const { labels, classNames } = useCalendarUi();
  if (!prompt.visible || !prompt.profileZone) return null;

  const now = Date.now();
  const booked = `${zoneCity(prompt.bookedZone)} time`;
  const profile = `${zoneCity(prompt.profileZone)} time`;
  const describe = describeError ?? ((error: unknown) => (error instanceof Error && error.message ? error.message : labels.zonePromptFailed));

  if (prompt.status === 'saved') {
    return (
      <p className={cx('cal-zoneprompt', 'cal-zoneprompt--done', classNames.zonePrompt, className)} role="status">
        {labels.zonePromptDone(booked, zoneLabel(now, prompt.bookedZone))}
      </p>
    );
  }

  return (
    <section className={cx('cal-zoneprompt', classNames.zonePrompt, className)} aria-label={labels.zonePromptAria}>
      <p className="cal-zoneprompt__title">{labels.zonePromptTitle(profile, zoneLabel(now, prompt.profileZone))}</p>
      <p className="cal-zoneprompt__body">{labels.zonePromptBody(booked, zoneLabel(now, prompt.bookedZone))}</p>
      {prompt.error != null && <p className="cal-zoneprompt__error" role="alert">{describe(prompt.error)}</p>}
      <div className="cal-zoneprompt__actions">
        <button type="button" className={cx('cal-btn', classNames.button)} onClick={prompt.decline} disabled={prompt.status === 'saving'}>
          {labels.zonePromptKeep(profile)}
        </button>
        <button type="button" className={cx('cal-btn', 'cal-btn--primary', classNames.button, classNames.buttonPrimary)} onClick={() => void prompt.accept()} disabled={prompt.status === 'saving'}>
          {prompt.status === 'saving' ? labels.zonePromptSaving : labels.zonePromptUse(booked)}
        </button>
      </div>
    </section>
  );
}
