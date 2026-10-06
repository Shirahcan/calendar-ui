import { createContext, useContext, useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';

/**
 * Customisation for every product (owner 2026-10-05: "the UI package should be built to be
 * used by all products with styling/customization options").
 *
 * Four levers, from lightest to heaviest. A product reaches for the next one only when the
 * previous cannot say what it needs:
 *   1. theme tokens  (colours, radius, font, grid height) -> CSS variables on one wrapper
 *   2. labels        (every sentence a person reads, for a product's voice or language)
 *   3. classNames    (extra classes per part, for Tailwind products)
 *   4. render props  (renderSlot / renderItem, when a part must look entirely different)
 * and `colorScheme`, so a product with its own dark-mode switch drives ours instead of the OS.
 *
 * Without a provider every component behaves exactly as before: defaults below, OS dark mode.
 */

/** Design tokens. Each maps to one `--cal-*` CSS variable. */
export interface CalendarTheme {
  accent: string;
  accentInk: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  ink: string;
  inkMuted: string;
  busy: string;
  danger: string;
  radius: string;
  radiusPill: string;
  font: string;
  hourHeight: string;
}

const TOKEN_VARS: Record<keyof CalendarTheme, string> = {
  accent: '--cal-accent',
  accentInk: '--cal-accent-ink',
  surface: '--cal-surface',
  surfaceMuted: '--cal-surface-muted',
  border: '--cal-border',
  ink: '--cal-ink',
  inkMuted: '--cal-ink-muted',
  busy: '--cal-busy',
  danger: '--cal-danger',
  radius: '--cal-radius',
  radiusPill: '--cal-radius-pill',
  font: '--cal-font',
  hourHeight: '--cal-hour-height',
};

/** Tokens as a style object of CSS variables, for a product that sets them on its own wrapper. */
export function themeStyle(theme: Partial<CalendarTheme> | undefined): CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme ?? {})) {
    const cssVar = TOKEN_VARS[key as keyof CalendarTheme];
    if (cssVar && typeof value === 'string' && value !== '') style[cssVar] = value;
  }

  return style as CSSProperties;
}

/** Every sentence the components show. Functions take what the sentence needs. */
export interface CalendarLabels {
  timesIn: (zone: string) => string;
  noTimes: string;
  findingTimes: string;
  holdingFor: (minutes: number, seconds: string) => string;
  pickAnother: string;
  confirm: string;
  confirming: string;
  bookedFor: (when: string) => string;
  slotTaken: string;
  holdExpired: string;
  bookingFailed: string;
  staleCalendars: string;
  moreItems: (count: number) => string;
  allDay: string;
  weekOf: (date: string) => string;
  zonePromptAria: string;
  zonePromptTitle: (profile: string, profileZone: string) => string;
  zonePromptBody: (booked: string, bookedZone: string) => string;
  zonePromptKeep: (profile: string) => string;
  zonePromptUse: (booked: string) => string;
  zonePromptSaving: string;
  zonePromptDone: (booked: string, bookedZone: string) => string;
  zonePromptFailed: string;
  scratchpadTitle: string;
  scratchpadHint: string;
  scratchpadPlaceholder: string;
  scratchpadLoading: string;
  scratchpadSaving: string;
  scratchpadSaved: string;
  scratchpadUnsaved: string;
  scratchpadFailed: string;
  scratchpadCommit: string;
  scratchpadCommitting: string;
  scratchpadCommitted: string;
  scratchpadShow: string;
  scratchpadHide: string;
  scratchpadHasText: string;
  holidayTitle: string;
  holidayRegion: string;
  holidayYear: string;
  holidayPrevYear: string;
  holidayNextYear: string;
  holidayWaiting: string;
  holidayWaitingHint: string;
  holidayList: string;
  holidayRemoved: string;
  holidayEmpty: string;
  holidayLoading: string;
  holidayEstimated: string;
  holidayConfirm: string;
  holidayReject: string;
  holidayRemove: string;
  holidayRemoveAsk: (name: string, date: string) => string;
  holidayPutBack: string;
  holidayRejected: string;
  holidayAddTitle: string;
  holidayAddDate: string;
  holidayAddName: string;
  holidayAdd: string;
  holidaySourceManual: string;
  holidaySourceComputed: string;
  holidayFailed: string;
}

export const DEFAULT_LABELS: CalendarLabels = {
  timesIn: (zone) => `Times in ${zone}`,
  noTimes: 'No times are open in this range.',
  findingTimes: 'Finding open times…',
  holdingFor: (m, s) => `We are holding this time for ${m}:${s}.`,
  pickAnother: 'Pick another time',
  confirm: 'Confirm booking',
  confirming: 'Booking…',
  bookedFor: (when) => `Booked for ${when}.`,
  slotTaken: 'That time was just taken. Please pick another.',
  holdExpired: 'We held that time for you, but the hold ran out. Please pick a time again.',
  bookingFailed: 'Something went wrong while booking. Please try again.',
  staleCalendars: 'Some calendars have not synced recently, so a time shown here may already be taken. We check again when you book.',
  moreItems: (n) => `+${n} more`,
  allDay: 'all day',
  weekOf: (date) => `Week of ${date}`,
  zonePromptAria: 'Timezone for your emails',
  zonePromptTitle: (profile, zone) => `Your emails use ${profile} (${zone})`,
  zonePromptBody: (booked, zone) =>
    `You booked on ${booked} (${zone}). Your emails and calendar invites use the timezone on your profile. Switch them to ${booked}?`,
  zonePromptKeep: (profile) => `Keep ${profile}`,
  zonePromptUse: (booked) => `Use ${booked}`,
  zonePromptSaving: 'Saving…',
  zonePromptDone: (booked, zone) => `Done. Your emails and calendar invites now use ${booked} (${zone}).`,
  zonePromptFailed: 'Your profile could not be updated. Please try again.',
  scratchpadTitle: 'Scratchpad',
  scratchpadHint: 'Only you see this. It is kept as you type.',
  scratchpadPlaceholder: 'Jot things down as the call goes…',
  scratchpadLoading: 'Loading…',
  scratchpadSaving: 'Saving…',
  scratchpadSaved: 'Saved',
  scratchpadUnsaved: 'Not saved yet',
  scratchpadFailed: 'Your notes could not be saved. Please try again.',
  scratchpadCommit: 'Save',
  scratchpadCommitting: 'Saving…',
  scratchpadCommitted: 'Saved.',
  scratchpadShow: 'Scratchpad',
  scratchpadHide: 'Hide scratchpad',
  scratchpadHasText: 'Has notes',
  holidayTitle: 'Public holidays',
  holidayRegion: 'Country or province',
  holidayYear: 'Year',
  holidayPrevYear: 'Previous year',
  holidayNextYear: 'Next year',
  holidayWaiting: 'Waiting for review',
  holidayWaitingHint: "Researched dates that close nobody's calendar until you confirm them.",
  holidayList: 'Holidays',
  holidayRemoved: 'Removed or rejected',
  holidayEmpty: 'No holidays for this year yet.',
  holidayLoading: 'Loading…',
  holidayEstimated: 'Estimated',
  holidayConfirm: 'Confirm',
  holidayReject: 'Reject',
  holidayRemove: 'Remove',
  holidayRemoveAsk: (name, date) => `Remove ${name} (${date})? Calendars open on that day again, and the yearly update will not put it back.`,
  holidayPutBack: 'Put back',
  holidayRejected: 'Rejected',
  holidayAddTitle: 'Add a holiday',
  holidayAddDate: 'Date',
  holidayAddName: 'Name',
  holidayAdd: 'Add',
  holidaySourceManual: 'Added by an admin',
  holidaySourceComputed: 'Official calendar',
  holidayFailed: 'That change did not save. Please try again.',
};

/** Extra classes per part, appended to the package's own (never replacing them). */
export interface CalendarClassNames {
  week: string;
  month: string;
  item: string;
  slots: string;
  slot: string;
  slotSelected: string;
  flow: string;
  button: string;
  buttonPrimary: string;
  zonePrompt: string;
  editor: string;
  scratchpad: string;
  scratchpadDock: string;
  holidayEditor: string;
}

export type ColorScheme = 'light' | 'dark' | 'auto';

export interface CalendarUiConfig {
  theme?: Partial<CalendarTheme>;
  /** Tokens laid over `theme` when the scheme resolves to dark. */
  darkTheme?: Partial<CalendarTheme>;
  /** 'auto' follows the OS; a product with its own dark-mode switch passes 'light' or 'dark'. */
  colorScheme?: ColorScheme;
  labels?: Partial<CalendarLabels>;
  classNames?: Partial<CalendarClassNames>;
  /** 24 (default, '14:30') or 12 ('2:30 PM') for the compact times on buttons and the grid. */
  hourCycle?: 12 | 24;
}

export interface ResolvedCalendarUi {
  labels: CalendarLabels;
  classNames: Partial<CalendarClassNames>;
  hourCycle: 12 | 24;
  /** date-fns pattern for a compact time: 'HH:mm' or 'h:mm a'. */
  timePattern: string;
}

const RESOLVED_DEFAULT: ResolvedCalendarUi = { labels: DEFAULT_LABELS, classNames: {}, hourCycle: 24, timePattern: 'HH:mm' };

const CalendarUiContext = createContext<ResolvedCalendarUi>(RESOLVED_DEFAULT);

/** The resolved labels, classes and hour cycle; the defaults when there is no provider. */
export function useCalendarUi(): ResolvedCalendarUi {
  return useContext(CalendarUiContext);
}

/** Join class names, skipping empties. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToScheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener('change', onChange);

  return () => mql.removeEventListener('change', onChange);
}

const osPrefersDark = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.(DARK_QUERY).matches;

export interface CalendarUiProviderProps extends CalendarUiConfig {
  children: ReactNode;
  className?: string;
}

/**
 * One wrapper around a product's calendar surfaces. It renders a `div.cal-root` with
 * `display: contents`, so it adds no box to the layout, and carries the theme as CSS variables
 * plus `data-cal-scheme` (the resolved 'light' or 'dark').
 */
export function CalendarUiProvider({ theme, darkTheme, colorScheme = 'auto', labels, classNames, hourCycle = 24, className, children }: CalendarUiProviderProps) {
  const osDark = useSyncExternalStore(subscribeToScheme, osPrefersDark, () => false);
  const scheme: 'light' | 'dark' = colorScheme === 'auto' ? (osDark ? 'dark' : 'light') : colorScheme;

  const value = useMemo<ResolvedCalendarUi>(() => ({
    labels: { ...DEFAULT_LABELS, ...labels },
    classNames: classNames ?? {},
    hourCycle,
    timePattern: hourCycle === 12 ? 'h:mm a' : 'HH:mm',
  }), [labels, classNames, hourCycle]);

  const style = useMemo(
    () => themeStyle(scheme === 'dark' ? { ...theme, ...darkTheme } : theme),
    [scheme, theme, darkTheme],
  );

  return (
    <CalendarUiContext.Provider value={value}>
      <div className={cx('cal-root', className)} data-cal-scheme={scheme} style={style}>
        {children}
      </div>
    </CalendarUiContext.Provider>
  );
}
