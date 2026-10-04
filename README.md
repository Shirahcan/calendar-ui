# @shirahcan/calendar-ui

Month, week and day views, the slot picker, the booking flow and the availability editor
for **calendar-service**. Headless hooks plus themeable components. It never calls the
service: the product passes fetchers that hit its OWN backend, which calls the service
through `shirahcan/calendar-client`.

Design: `portify/docs/plans/calendar-service-2026-10-02/07-ui-package.md`.

## Install (git dependency until GitHub Packages auth is set up, O8)

```json
"@shirahcan/calendar-ui": "github:Shirahcan/calendar-ui#v0.2.2"
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

## Theming

No Tailwind dependency. Set the CSS variables on a wrapper:

```css
.portify-calendar {
  --cal-accent: #4361ee;
  --cal-surface: rgb(255 255 255 / 0.7);
  --cal-radius: 2rem;
}
```

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

Other products' bookings arrive from the service as nameless "Busy" blocks; the package
keeps that privacy line.
