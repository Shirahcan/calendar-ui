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
  wrapUpTitle: string;
  wrapUpHint: string;
  wrapUpKeep: string;
  wrapUpDiscard: string;
  wrapUpDiscardConfirm: string;
  wrapUpDiscardYes: string;
  wrapUpDiscardNo: string;
  /* A pad action's proposal (plan N5) */
  proposalTitle: (action: string) => string;
  proposalYours: string;
  proposalTheirs: string;
  proposalAccept: string;
  proposalDismiss: string;
  proposalWorking: string;
  /* Unsettled pads (plan N4) */
  pendingPadsTitle: (count: number) => string;
  pendingPadsHint: string;
  pendingPadsReview: string;
  pendingPadsDismiss: string;
  padReviewTitle: (meeting: string) => string;
  padReviewHint: string;
  padReviewClose: string;
  padReviewDiscard: string;
  padReviewDiscardAsk: string;
  padReviewOpenMeeting: string;
  /* Meeting notes (plan N2) */
  notesTitle: string;
  notesEmpty: string;
  notesLoading: string;
  notesPlaceholder: string;
  notesPrivate: string;
  notesPrivateHint: string;
  notesAdd: string;
  notesAdding: string;
  notesSave: string;
  notesCancel: string;
  notesMenu: string;
  notesEdit: string;
  notesCopy: string;
  notesCopied: string;
  notesDelete: string;
  notesDeleteAsk: string;
  notesPrivateBadge: string;
  notesSomeone: string;
  notesFailed: string;
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
  // Booking reminder times (ReminderPolicyEditor)
  reminderTitle: string;
  reminderIntro: string;
  reminderNone: string;
  reminderLead: (minutes: number) => string;
  reminderRemove: (lead: string) => string;
  reminderAddAmount: string;
  reminderAddUnit: string;
  reminderUnitMinutes: string;
  reminderUnitHours: string;
  reminderUnitDays: string;
  reminderAdd: string;
  reminderSave: string;
  reminderSaved: string;
  reminderUseDefault: string;
  reminderIsDefault: string;
  reminderLoading: string;
  reminderTooMany: (max: number) => string;
  reminderOutOfRange: string;
  reminderFailed: string;
  // Scheduling policy (SchedulingPolicyEditor)
  policyTitle: string;
  policyIntro: string;
  policyLoading: string;
  policyBuffers: string;
  policyMinBuffer: string;
  policyDefaultBuffer: string;
  policyMaxBuffer: string;
  policyBufferChoices: string;
  policyAddChoice: string;
  policyRemoveChoice: (minutes: number) => string;
  policyBooking: string;
  policyNotice: string;
  policyNoticeHint: string;
  policyHorizon: string;
  policyHold: string;
  policySeedWeek: string;
  policySeedWeekHint: string;
  policyObserveHolidays: string;
  policySave: string;
  policySaved: string;
  policyUseDefault: string;
  policyIsDefault: string;
  policyFailed: string;
  // Holiday places and rules (HolidayRulesEditor)
  rulesTitle: string;
  rulesIntro: string;
  rulesLoading: string;
  rulesPlace: string;
  rulesPlaceCode: string;
  rulesPlaceName: string;
  rulesAddPlace: string;
  rulesNone: string;
  rulesNoDate: string;
  rulesEdit: string;
  rulesActionsFor: (name: string) => string;
  rulesRemove: string;
  rulesConfirmRemove: (name: string) => string;
  rulesAdd: string;
  rulesChange: string;
  rulesSave: string;
  rulesName: string;
  rulesKind: string;
  rulesKindName: (kind: 'fixed' | 'nth_weekday' | 'last_weekday' | 'weekday_on_or_before' | 'easter_offset') => string;
  rulesNth: string;
  rulesWeekday: string;
  rulesMonth: string;
  rulesDay: string;
  rulesEasterDays: string;
  rulesActive: string;
  rulesWeekdayName: (isoDay: number) => string;
  rulesMonthName: (month: number) => string;
  rulesDescribe: (kind: string, params: { month?: number; day?: number; weekday?: number; n?: number; days?: number }) => string;
  rulesPreview: (year: number) => string;
  rulesFailed: string;
  // Calendar connections (CalendarConnectionsPanel)
  connTitle: string;
  connIntro: string;
  connLoading: string;
  connNone: string;
  connProvider: (provider: 'google' | 'microsoft') => string;
  connNoEmail: string;
  connNeedsReauth: string;
  connSynced: (iso: string) => string;
  connNotSyncedYet: string;
  connReconnect: string;
  connActionsFor: (provider: string) => string;
  connDisconnect: string;
  connConfirmDisconnect: (provider: string, email: string | null) => string;
  connConnect: (provider: string) => string;
  connFailed: string;
  // Booking links (BookingLinksManager, BookingLinkEditor)
  linksTitle: string;
  linksIntro: string;
  linksLoading: string;
  linksNone: string;
  linkNew: string;
  linkEdit: string;
  linkCopy: string;
  linkCopied: string;
  linkCopyFailed: string;
  linkMakeDefault: string;
  linkSwitchOff: string;
  linkSwitchOn: string;
  linkDelete: string;
  linkConfirmDelete: (name: string) => string;
  linkDeleted: string;
  linkSaved: string;
  linkCreated: string;
  linkFailed: string;
  linkSaveFailed: string;
  linkActionsFor: (name: string) => string;
  linkDefaultBadge: string;
  linkOffBadge: string;
  linkDaysAheadShort: (days: number) => string;
  linkDailyCapShort: (n: number) => string;
  linkCreateTitle: string;
  linkEditTitle: string;
  linkClose: string;
  linkName: string;
  linkSlug: string;
  linkSlugPlaceholder: string;
  linkSlugHelp: string;
  linkDescription: string;
  linkDuration: string;
  linkColor: string;
  linkBufferBefore: string;
  linkBufferAfter: string;
  linkBufferHelp: (min: number, max: number) => string;
  linkDaysAhead: string;
  linkDailyCap: string;
  linkUsual: string;
  linkUnlimited: string;
  linkActive: string;
  linkDefault: string;
  linkCancel: string;
  linkSave: string;
  linkCreate: string;
  linkExternal: string;
  linkExternalHelp: string;
  linkExternalUrl: string;
  linkExternalCallUrl: string;
  linkExternalBadge: string;
  linkOpenExternal: string;
  // Availability (AvailabilityEditor)
  availTitle: string;
  availIntro: (zone: string) => string;
  availTabWeekly: string;
  availTabDates: string;
  availTabTimeOff: string;
  availTabHolidays: string;
  availRibbon: string;
  availDayNames: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', string>;
  availDayOff: string;
  availAddHours: string;
  availRemoveHours: (day: string, start: string, end: string) => string;
  availBuffer: string;
  availBufferHelp: string;
  availDayBuffer: string;
  availDayBufferFor: (day: string) => string;
  availBufferSameAsDefault: (minutes: number) => string;
  availMinutes: (minutes: number) => string;
  availOpenDay: (day: string) => string;
  availDatesIntro: string;
  availDate: string;
  availClosedAllDay: string;
  availAddChange: string;
  availNoChanges: string;
  availTimeOffIntro: string;
  availFrom: string;
  availTo: string;
  availPartDay: string;
  availAddTimeOff: string;
  availNoTimeOff: string;
  availRemove: string;
  availHolidaysIntro: string;
  availObserve: string;
  availRegion: string;
  availWorking: string;
  availNoHolidays: string;
  availZone: string;
  availSave: string;
  availSaved: string;
  availDiscard: string;
  availUnsaved: string;
  availLoading: string;
  availFailed: string;
  availNoHours: string;
}

/** "1 day", "2 hours", "1 hour 30 minutes", "15 minutes". */
export function reminderLeadLabel(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const d = minutes / 1440;
    return `${d} ${d === 1 ? 'day' : 'days'}`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '', m > 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : ''].filter(Boolean).join(' ');
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
  wrapUpTitle: 'You have notes in your scratchpad',
  wrapUpHint: 'The call is over. Save them, keep them for next time, or let them go.',
  wrapUpKeep: 'Keep as a draft',
  wrapUpDiscard: 'Discard',
  wrapUpDiscardConfirm: 'Discard these notes for good?',
  wrapUpDiscardYes: 'Discard',
  wrapUpDiscardNo: 'Keep them',
  proposalTitle: (action) => action,
  proposalYours: 'Your notes',
  proposalTheirs: 'Suggested',
  proposalAccept: 'Use this version',
  proposalDismiss: 'Keep mine',
  proposalWorking: 'Working on it…',
  pendingPadsTitle: (count) => (count === 1 ? 'You have call notes that are not saved anywhere yet' : `You have ${count} sets of call notes that are not saved anywhere yet`),
  pendingPadsHint: 'Review them and save them where they belong, or discard them.',
  pendingPadsReview: 'Review',
  pendingPadsDismiss: 'Hide for now',
  padReviewTitle: (meeting) => `Call notes: ${meeting}`,
  padReviewHint: 'Only you see these. Changes are kept as you type.',
  padReviewClose: 'Close',
  padReviewDiscard: 'Discard notes',
  padReviewDiscardAsk: 'Discard these call notes for good? This cannot be undone.',
  padReviewOpenMeeting: 'Open meeting',
  notesTitle: 'Notes',
  notesEmpty: 'No notes yet.',
  notesLoading: 'Loading notes…',
  notesPlaceholder: 'Write a note about this meeting…',
  notesPrivate: 'Only visible to me',
  notesPrivateHint: 'Private notes are never shown to anyone else.',
  notesAdd: 'Add note',
  notesAdding: 'Adding…',
  notesSave: 'Save',
  notesCancel: 'Cancel',
  notesMenu: 'Note actions',
  notesEdit: 'Edit',
  notesCopy: 'Copy text',
  notesCopied: 'Copied.',
  notesDelete: 'Delete',
  notesDeleteAsk: 'Delete this note? This cannot be undone.',
  notesPrivateBadge: 'Private',
  notesSomeone: 'Someone',
  notesFailed: 'That did not work. Please try again.',
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
  reminderTitle: 'Meeting reminders',
  reminderIntro: 'Everyone a meeting is for gets a reminder at each of these times before it starts. A meeting booked later than a reminder time skips that one.',
  reminderNone: 'No reminders are sent.',
  reminderLead: (minutes) => `${reminderLeadLabel(minutes)} before`,
  reminderRemove: (lead) => `Remove the reminder ${lead}`,
  reminderAddAmount: 'How long before',
  reminderAddUnit: 'Unit',
  reminderUnitMinutes: 'minutes',
  reminderUnitHours: 'hours',
  reminderUnitDays: 'days',
  reminderAdd: 'Add',
  reminderSave: 'Save reminder times',
  reminderSaved: 'Saved',
  reminderUseDefault: 'Use the standard times',
  reminderIsDefault: 'These are the standard times.',
  reminderLoading: 'Loading reminder times...',
  reminderTooMany: (max) => `Up to ${max} reminders.`,
  reminderOutOfRange: 'A reminder must be between 1 minute and 7 days before.',
  reminderFailed: 'Those reminder times did not save. Please try again.',
  policyTitle: 'Scheduling rules',
  policyIntro: 'How every booking on this platform is scheduled. Changes apply to new bookings straight away.',
  policyLoading: 'Loading the scheduling rules...',
  policyBuffers: 'Time kept free around meetings',
  policyMinBuffer: 'Smallest allowed (minutes)',
  policyDefaultBuffer: 'Usual (minutes)',
  policyMaxBuffer: 'Largest allowed (minutes)',
  policyBufferChoices: 'Choices people pick from',
  policyAddChoice: 'Add choice',
  policyRemoveChoice: (minutes) => `Remove ${minutes} minutes`,
  policyBooking: 'Booking',
  policyNotice: 'Least notice (minutes)',
  policyNoticeHint: 'The soonest a time can be booked, counted from now.',
  policyHorizon: 'How far ahead (days)',
  policyHold: 'Hold a picked time for (minutes)',
  policySeedWeek: 'The week a new person starts with',
  policySeedWeekHint: 'Also the hours a day gets when someone turns it on.',
  policyObserveHolidays: "Close on a person's public holidays unless they choose otherwise",
  policySave: 'Save rules',
  policySaved: 'Saved',
  policyUseDefault: 'Use the standard rules',
  policyIsDefault: 'Using the standard rules',
  policyFailed: 'Those scheduling rules did not save. Please try again.',
  rulesTitle: 'Public holidays by place',
  rulesIntro: 'The places people can observe holidays for, and the rule that gives each holiday its date. Every product uses these.',
  rulesLoading: 'Loading the places...',
  rulesPlace: 'Place',
  rulesPlaceCode: 'Code (e.g. KE or CA-ON)',
  rulesPlaceName: 'Place name',
  rulesAddPlace: 'Add place',
  rulesNone: 'No holidays yet.',
  rulesNoDate: 'Not this year',
  rulesEdit: 'Edit',
  rulesActionsFor: (name) => `Actions for ${name}`,
  rulesRemove: 'Remove',
  rulesConfirmRemove: (name) => `Remove ${name}? Its dates stop closing calendars.`,
  rulesAdd: 'Add holiday',
  rulesChange: 'Change holiday',
  rulesSave: 'Save holiday',
  rulesName: 'Name',
  rulesKind: 'Falls on',
  rulesKindName: (kind) => ({ fixed: 'The same date every year', nth_weekday: 'A weekday of the month (e.g. 2nd Monday)', last_weekday: 'The last weekday of the month', weekday_on_or_before: 'A weekday on or before a date', easter_offset: 'Days from Easter Sunday' })[kind],
  rulesNth: 'Which one (1 to 5)',
  rulesWeekday: 'Weekday',
  rulesMonth: 'Month',
  rulesDay: 'Day',
  rulesEasterDays: 'Days from Easter (Good Friday is -2)',
  rulesActive: 'In use',
  rulesWeekdayName: (d) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][d - 1] ?? String(d),
  rulesMonthName: (m) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] ?? String(m),
  rulesDescribe: (kind, p) => {
    const day = (d?: number) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][(d ?? 1) - 1];
    const month = (m?: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][(m ?? 1) - 1];
    const nth = ['', 'first', 'second', 'third', 'fourth', 'fifth'][p.n ?? 1];
    switch (kind) {
      case 'fixed': return `${month(p.month)} ${p.day}`;
      case 'nth_weekday': return `The ${nth} ${day(p.weekday)} of ${month(p.month)}`;
      case 'last_weekday': return `The last ${day(p.weekday)} of ${month(p.month)}`;
      case 'weekday_on_or_before': return `The ${day(p.weekday)} on or before ${month(p.month)} ${p.day}`;
      case 'easter_offset': return p.days === 0 ? 'Easter Sunday' : `${Math.abs(p.days ?? 0)} days ${(p.days ?? 0) < 0 ? 'before' : 'after'} Easter Sunday`;
      default: return kind;
    }
  },
  rulesPreview: (year) => `Dates in ${year}`,
  rulesFailed: 'That holiday change did not save. Please try again.',
  connTitle: 'Connected calendars',
  connIntro: 'Busy time on a connected calendar keeps you from being double-booked, in every product you use.',
  connLoading: 'Loading your calendars...',
  connNone: 'No calendar connected yet.',
  connProvider: (p) => (p === 'google' ? 'Google Calendar' : 'Outlook Calendar'),
  connNoEmail: 'Connected account',
  connNeedsReauth: 'Needs reconnecting: busy time is not being read.',
  connSynced: (iso) => `Busy time read ${new Date(iso).toLocaleString()}`,
  connNotSyncedYet: 'Reading busy time for the first time...',
  connReconnect: 'Reconnect',
  connActionsFor: (provider) => `Actions for ${provider}`,
  connDisconnect: 'Disconnect',
  connConfirmDisconnect: (provider, email) => `Disconnect ${provider}${email ? ` (${email})` : ''}? Its busy time stops counting.`,
  connConnect: (provider) => `Connect ${provider}`,
  connFailed: 'That did not work. Please try again.',
  linksTitle: 'Booking links',
  linksIntro: 'Each link is a way to book time with you, with its own length and rules.',
  linksLoading: 'Loading your links...',
  linksNone: 'No booking links yet. Create one to start taking bookings.',
  linkNew: 'Create link',
  linkEdit: 'Edit',
  linkCopy: 'Copy reference',
  linkCopied: 'Reference copied',
  linkCopyFailed: 'The reference could not be copied. Select it and copy it instead.',
  linkMakeDefault: 'Make default',
  linkSwitchOff: 'Switch off',
  linkSwitchOn: 'Switch on',
  linkDelete: 'Delete',
  linkConfirmDelete: (name) => `Delete "${name}"? It stops taking bookings. Meetings already booked through it stay booked.`,
  linkDeleted: 'Link deleted',
  linkSaved: 'Link saved',
  linkCreated: 'Link created',
  linkFailed: 'That did not work. Please try again.',
  linkSaveFailed: 'The link could not be saved.',
  linkActionsFor: (name) => `Actions for ${name}`,
  linkDefaultBadge: 'Default',
  linkOffBadge: 'Off',
  linkDaysAheadShort: (days) => `up to ${days} days ahead`,
  linkDailyCapShort: (n) => `at most ${n} a day`,
  linkCreateTitle: 'Create booking link',
  linkEditTitle: 'Edit booking link',
  linkClose: 'Close',
  linkName: 'Name',
  linkSlug: 'Reference',
  linkSlugPlaceholder: 'Made from the name',
  linkSlugHelp: 'Your own short reference for this link. Lowercase letters, numbers and dashes.',
  linkDescription: 'Description',
  linkDuration: 'Length',
  linkColor: 'Colour',
  linkBufferBefore: 'Break before (minutes)',
  linkBufferAfter: 'Break after (minutes)',
  linkBufferHelp: (min, max) => `Leave empty to keep your usual break, or set ${min} to ${max} minutes for this link.`,
  linkDaysAhead: 'Bookable up to (days ahead)',
  linkDailyCap: 'Most bookings a day',
  linkUsual: 'Usual',
  linkUnlimited: 'No limit',
  linkActive: 'Taking bookings',
  linkDefault: 'Default link',
  linkCancel: 'Cancel',
  linkSave: 'Save changes',
  linkCreate: 'Create link',
  linkExternal: 'Booked elsewhere (optional)',
  linkExternalHelp: 'Use your own scheduler instead: people book on that page and meet in that room.',
  linkExternalUrl: 'Booking page address',
  linkExternalCallUrl: 'Call room address',
  linkExternalBadge: 'External',
  linkOpenExternal: 'Open booking page',
  availTitle: 'Availability',
  availIntro: (zone) => `When people can book time with you. Times are on ${zone} time.`,
  availTabWeekly: 'Weekly hours',
  availTabDates: 'Date changes',
  availTabTimeOff: 'Time off',
  availTabHolidays: 'Public holidays',
  availRibbon: 'Your week at a glance',
  availDayNames: { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' },
  availDayOff: 'Unavailable',
  availAddHours: 'Add hours',
  availRemoveHours: (day, start, end) => `Remove ${start} to ${end} on ${day}`,
  availBuffer: 'Time kept free around each meeting',
  availBufferHelp: 'A day can keep a different break: set it on that day.',
  availDayBuffer: 'Break',
  availDayBufferFor: (day) => `Break around meetings on ${day}`,
  availBufferSameAsDefault: (minutes) => `Usual (${minutes} min)`,
  availMinutes: (minutes) => `${minutes} min`,
  availOpenDay: (day) => `Take meetings on ${day}`,
  availDatesIntro: "Change one date's hours without touching your weekly pattern, or close it for the day.",
  availDate: 'Date',
  availClosedAllDay: 'Closed all day',
  availAddChange: 'Add change',
  availNoChanges: 'No date changes. Your weekly hours apply every week.',
  availTimeOffIntro: 'Days or hours you are away. Nothing can be booked in them.',
  availFrom: 'From',
  availTo: 'To',
  availPartDay: 'Part of a day',
  availAddTimeOff: 'Add time off',
  availNoTimeOff: 'No time off planned.',
  availRemove: 'Remove',
  availHolidaysIntro: 'Close on the public holidays where you work. Pick any you will work anyway.',
  availObserve: 'Close on public holidays',
  availRegion: 'Where',
  availWorking: 'Working this day',
  availNoHolidays: 'No public holidays found for that place and year.',
  availZone: 'Time zone',
  availSave: 'Save availability',
  availSaved: 'Saved',
  availDiscard: 'Discard changes',
  availUnsaved: 'Unsaved changes',
  availLoading: 'Loading availability...',
  availFailed: 'Your availability did not save. Please try again.',
  availNoHours: 'No hours yet. Add the hours you can take meetings.',
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
  reminderEditor: string;
  availabilityEditor: string;
  policyEditor: string;
  holidayRulesEditor: string;
  connectionsPanel: string;
  linksManager: string;
  linkEditor: string;
  input: string;
  notes: string;
  pendingPads: string;
  padReview: string;
  proposal: string;
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
