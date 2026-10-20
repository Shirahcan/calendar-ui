import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MeetingHistory } from '../src/components/MeetingHistory';

describe('MeetingHistory', () => {
  it('tells a meeting\'s story on the viewer\'s clock: booked once, moved, cancelled, with who and why', () => {
    render(
      <MeetingHistory
        timezone="Africa/Lagos"
        entries={[
          { event: 'created', at: '2026-10-01T09:00:00Z', by: 'Maria Garcia' },
          { event: 'confirmed', at: '2026-10-01T09:00:05Z' },
          { event: 'participant_added', at: '2026-10-01T09:01:00Z', by: 'System' },
          { event: 'rescheduled', at: '2026-10-02T10:00:00Z', by: 'David Kim', reason: 'A clash', from_start_utc: '2026-10-08T18:00:00Z', to_start_utc: '2026-10-09T18:00:00Z' },
          { event: 'cancelled', at: '2026-10-03T11:30:00Z', by: null, reason: 'No longer needed' },
          { event: 'rebooked', at: '2026-10-04T08:00:00Z', by: 'Maria Garcia', reason: 'booker' },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    const t = (i: number) => items[i]?.textContent ?? '';
    expect(t(0)).toMatch(/^Booked on .*Oct 1, 2026.* by Maria Garcia$/);
    expect(t(1)).toContain('Rescheduled on');
    expect(t(1)).toContain('by David Kim');
    expect(t(1)).toMatch(/From .*Oct 8, 2026.*7:00 PM.* to .*Oct 9, 2026/);
    expect(t(1)).toContain('Reason: A clash');
    expect(t(2)).toMatch(/^Cancelled on .*Reason: No longer needed$/);
    expect(t(2)).not.toContain(' by ');
    expect(t(3)).toMatch(/^Booked again on .* by Maria Garcia$/);
    expect(t(3)).not.toContain('Reason');
  });

  it('says nothing when nothing a person reads has happened', () => {
    const { container } = render(<MeetingHistory timezone="UTC" entries={[{ event: 'held', at: '2026-10-01T09:00:00Z' }]} />);
    expect(container.textContent).toBe('');
  });
});
