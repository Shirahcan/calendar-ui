import { formatIn } from '../time';
import type { Slot } from '../types';
import { zoneCity, zoneLabel as namedZone } from '../zoned';

export interface SlotPickerProps {
  /** From useSlots: slots grouped by the viewer's local day. */
  byDay: Map<string, Slot[]>;
  /** The person booking: times are shown in this zone. */
  viewerZone: string;
  /** The host's zone; when it differs, each time also says the host's local time. */
  hostZone?: string;
  onPick: (slot: Slot) => void;
  selected?: string | null;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function SlotPicker({ byDay, viewerZone, hostZone, onPick, selected, disabled, emptyLabel = 'No times are open in this range.', className }: SlotPickerProps) {
  if (byDay.size === 0) {
    return <p className={`cal-slots__empty ${className ?? ''}`}>{emptyLabel}</p>;
  }

  // A plain string (not a boolean flag) so TypeScript keeps the narrowing below.
  const hostTz = hostZone !== undefined && hostZone !== viewerZone ? hostZone : null;

  // Every time names its zone (estate rule 2026-10-04): the buttons stay compact, so the zone is
  // said once, above them, and in every button's accessible name.
  const firstStart = [...byDay.values()][0]?.[0]?.start_utc ?? Date.now();

  return (
    <div className={`cal-slots ${className ?? ''}`}>
      <p className="cal-slots__zone">Times in {namedZone(firstStart, viewerZone)}</p>
      {[...byDay.entries()].map(([key, slots]) => (
        <section key={key} className="cal-slots__day" aria-label={formatIn(slots[0]!.start_utc, viewerZone, 'EEEE d MMMM yyyy')}>
          <h4 className="cal-slots__dayhead">{formatIn(slots[0]!.start_utc, viewerZone, 'EEE d MMM')}</h4>
          <div className="cal-slots__times">
            {slots.map((s) => {
              const label = `${formatIn(s.start_utc, viewerZone, 'EEEE d MMMM, h:mm a')} ${namedZone(s.start_utc, viewerZone)}`
                + (hostTz ? `, ${formatIn(s.start_utc, hostTz, 'h:mm a')} in ${zoneCity(hostTz)}` : '');

              return (
                <button type="button" key={s.start_utc} disabled={disabled} aria-label={label} aria-pressed={selected === s.start_utc}
                  className={`cal-slot${selected === s.start_utc ? ' is-selected' : ''}`} onClick={() => onPick(s)}>
                  <span className="cal-slot__time">{formatIn(s.start_utc, viewerZone, 'HH:mm')}</span>
                  {hostTz && <span className="cal-slot__host">{formatIn(s.start_utc, hostTz, 'HH:mm')} {namedZone(s.start_utc, hostTz)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
