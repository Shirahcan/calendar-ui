import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MeetingStatusFilter } from '../src/components/MeetingStatusFilter';

describe('MeetingStatusFilter', () => {
  it('offers every status in the calendar legend words and clears back to all', () => {
    const onChange = vi.fn();
    render(<MeetingStatusFilter value={null} onChange={onChange} />);
    const select = screen.getByLabelText('Status') as HTMLSelectElement;

    expect([...select.options].map((o) => o.text)).toEqual(['All statuses', 'Awaiting approval', 'Scheduled', 'Confirmed', 'In progress', 'Completed', 'Cancelled', 'No-show', 'Rescheduled']);
    fireEvent.change(select, { target: { value: 'no_show' } });
    expect(onChange).toHaveBeenLastCalledWith('no_show');
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
