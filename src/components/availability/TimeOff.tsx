import { useState } from 'react';
import type { AvailabilitySpec } from '../../types';
import type { EditorAction } from '../../hooks/useAvailabilityEditor';
import { cx, useCalendarUi } from '../../theme';
import { dateLabel } from './DateChanges';

/** "Mon, Oct 12, 2026, 14:00" for a partial block's wall-clock times. */
function wallLabel(local: string): string {
  const [d = '', t = ''] = local.split('T');

  return `${dateLabel(d)}, ${t.slice(0, 5)}`;
}

/** Days (or part of one) the person is away: nothing can be booked in them. */
export function TimeOff({ spec, edit, disabled }: { spec: AvailabilitySpec; edit: (a: EditorAction) => void; disabled?: boolean }) {
  const { labels, classNames } = useCalendarUi();
  const [partial, setPartial] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const btn = cx('cal-btn', classNames.button);
  const blocks = spec.blocks ?? [];

  const valid = partial ? Boolean(from && to && to > from) : Boolean(from && (!to || to >= from));
  const add = () => {
    if (!valid) return;
    edit({ type: 'addBlock', block: partial ? { start: from, end: to } : { from, to: to || from } });
    setFrom('');
    setTo('');
  };

  return (
    <div className="cal-avail__section">
      <p className="cal-avail__intro">{labels.availTimeOffIntro}</p>

      <div className="cal-avail__form">
        <label className="cal-avail__check">
          <input type="checkbox" checked={partial} disabled={disabled} onChange={(e) => { setPartial(e.target.checked); setFrom(''); setTo(''); }} />
          {labels.availPartDay}
        </label>
        <label className="cal-avail__field">
          {labels.availFrom}
          <input className="cal-input" type={partial ? 'datetime-local' : 'date'} step={900} value={from} disabled={disabled} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="cal-avail__field">
          {labels.availTo}
          <input className="cal-input" type={partial ? 'datetime-local' : 'date'} step={900} value={to} disabled={disabled} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className={btn} disabled={disabled || !valid} onClick={add}>
          {labels.availAddTimeOff}
        </button>
      </div>

      {blocks.length === 0 ? (
        <p className="cal-avail__empty">{labels.availNoTimeOff}</p>
      ) : (
        <ul className="cal-avail__list">
          {blocks.map((b, i) => (
            <li key={i} className="cal-avail__item">
              <span className="cal-avail__item-date">
                {'from' in b ? (b.from === b.to ? dateLabel(b.from) : `${dateLabel(b.from)} - ${dateLabel(b.to)}`) : `${wallLabel(b.start)} - ${wallLabel(b.end)}`}
              </span>
              <button type="button" className={cx(btn, 'cal-btn--ghost')} disabled={disabled} onClick={() => edit({ type: 'removeBlock', index: i })}>
                {labels.availRemove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
