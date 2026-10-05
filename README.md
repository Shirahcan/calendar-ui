# @shirahcan/calendar-ui

Month, week and day views, the slot picker, the booking flow and the availability editor
for **calendar-service**. Headless hooks plus themeable components. It never calls the
service: the product passes fetchers that hit its OWN backend, which calls the service
through `shirahcan/calendar-client`.

Design: `portify/docs/plans/calendar-service-2026-10-02/07-ui-package.md`.

## Install (git dependency until GitHub Packages auth is set up, O8)

```json
"@shirahcan/calendar-ui": "github:Shirahcan/calendar-ui#v0.3.0"
```

`prepare` builds `dist/` on install. Peer deps: React 19.

```ts
import '@shirahcan/calendar-ui/styles.css';
import { useCalendarRange, useSlots, useBookingFlow, WeekView, BookingFlow } from '@shirahcan/calendar-ui';
```

## Time zones

Every hook and component takes an explicit IANA zone. Nothing reads the machine's zone
(the test suite runs in `Pacific/Kiritimati` to prove it). Slots are grouped by the
VIEWER's day; when the host's zone differs, each time also shows the host's local time.

**The estate rule (2026-10-04), the same in every product:**

- **Which clock:** a screen shows times on the viewer's clock: `useDisplayTimezone()` returns the
  zone they picked with a "Show times in" control (kept in that browser only, never written to a
  profile), else the device's. Emails and calendar files use the profile zone, server side.
- **Always labelled:** every date and time names its zone. Use `formatZonedTime`,
  `formatZonedTimeRange`, `formatZonedDateTime` ("Wed, Oct 7, 2026, 8:25 PM EDT"; a zone with no abbreviation gets its full name, never "GMT+1"); never a bare
  `toLocaleTimeString()`.
- **A day is the viewer's day:** list slots under a picked date with `onDay(items, day, zone,
  startOf)`, and date a chosen slot from the slot itself, never from the date that was clicked.
  The server side of the same rule is `ViewerDay` in `shirahcan/calendar-client`.
- **Typed times:** a `datetime-local` value carries no zone. Convert it with
  `wallTimeToInstant(value, zone)` before sending it, and fill one with
  `instantToWallTime(instant, zone)`; never send the raw value (a server reads it on its own clock).
- **Ask, never switch, the profile zone:** after a booking made on a clock other than the
  profile's, render `<ProfileZonePrompt prompt={useProfileZonePrompt({ profileZone, bookedZone, save })} />`.
  It asks whether emails and invites should follow the new zone (owner decision 2026-10-04),
  only when the two zones really read different clocks (`sameClock`), and remembers a "no" for
  that pair on this browser. `save` is the product's own profile endpoint.

## Customising it for a product (v0.4.0)

Every product uses the same components; each one makes them its own with four levers, lightest
first. Reach for the next one only when the previous cannot say what you need.

```tsx
import { CalendarUiProvider } from '@shirahcan/calendar-ui';
import '@shirahcan/calendar-ui/styles.css';

<CalendarUiProvider
  theme={{ accent: '#6f6df3', surface: '#fff', radius: '1rem', font: 'Inter, sans-serif' }}
  darkTheme={{ surface: '#0b1220', ink: '#e2e8f0' }}
  colorScheme={isDark ? 'dark' : 'light'}            // or 'auto' (the OS decides)
  hourCycle={12}                                       // '2:30 PM' instead of '14:30'
  labels={{ timesIn: (zone) => `Showing times in ${zone}`, confirm: 'Book interview' }}
  classNames={{ slot: 'rounded-lg px-3', buttonPrimary: 'shadow-md' }}
>
  <SlotPicker ... />
  <WeekView ... />
</CalendarUiProvider>
```

1. **Theme tokens** become CSS variables on one `.cal-root` wrapper (`display: contents`, so it
   adds no box). Tokens: `accent`, `accentInk`, `surface`, `surfaceMuted`, `border`, `ink`,
   `inkMuted`, `busy`, `danger`, `radius`, `radiusPill`, `font`, `hourHeight`.
   `themeStyle(tokens)` gives the same variables as a style object for your own wrapper.
2. **Labels**: every sentence the components show (`DEFAULT_LABELS` lists them), for a product's
   voice or language. A prop that already takes text (`emptyLabel`, `confirmLabel`) still wins.
3. **classNames**: extra classes per part (`week`, `month`, `item`, `slots`, `slot`,
   `slotSelected`, `flow`, `button`, `buttonPrimary`, `zonePrompt`, `editor`), appended to the
   package's own, so Tailwind products style parts without CSS files.
4. **Render props**: `SlotPicker renderSlot`, `MonthView renderItem`, `WeekView renderItem`, when
   a part must look entirely different. Accessible names and zone wording stay the package's.

`colorScheme` lets a product with its own dark-mode switch drive the calendar instead of the OS.
Without a provider everything behaves as before (defaults, OS dark mode).

Plain CSS still works too: set the variables on your own wrapper, targeting the components
(Portify's `.pf-cal :where(.cal-week, ...)`), or skip `styles.css` entirely and style the
`cal-*` classes yourself.

Variables: `--cal-accent`, `--cal-accent-ink`, `--cal-surface`, `--cal-surface-muted`,
`--cal-border`, `--cal-ink`, `--cal-ink-muted`, `--cal-busy`, `--cal-danger`,
`--cal-radius`, `--cal-radius-pill`, `--cal-font`, `--cal-hour-height`. Every component
also takes a `className`.

## Pieces

| Export | Does |
|---|---|
| `useCalendarRange` | month / week / day navigation in a zone |
| `useSlots` | slots for a booking type, grouped by the viewer's day; ignores late answers |
| `useBookingFlow` | pick, hold (with countdown), confirm; error codes from the service |
| `useDragSelect` | drag a window on a day column |
| `useAvailabilityEditor` | edit a schema-1 spec in memory; `specProblems` mirrors the service's checks |
| `MonthView`, `WeekView`, `DayView` | grids; service events via `eventsToItems`, plus product layers |
| `SlotPicker`, `BookingFlow`, `AvailabilityEditor` | the booking and availability surfaces |
| `useDisplayTimezone`, `formatZoned*`, `zoneLabel`, `onDay` | which clock a screen shows, and naming it |
| `wallTimeToInstant`, `instantToWallTime`, `sameClock`, `zoneCity` | typed times and zone comparison |
| `useProfileZonePrompt`, `ProfileZonePrompt` | after a booking, ask whether emails should follow the booked zone |
| `useMeetingScratchpad`, `MeetingScratchpad` | a private pad beside a live call; the product supplies load / save / commit and decides who sees it (v0.5.0) |

Other products' bookings arrive from the service as nameless "Busy" blocks; the package
keeps that privacy line.
