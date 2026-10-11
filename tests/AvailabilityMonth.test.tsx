import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AvailabilityMonth, availabilityLevel } from '../src';

describe('availabilityLevel', () => {
  it('is the one rule for how a count reads', () => {
    expect([0, 1, 2, 3, 7, 8, 20].map(availabilityLevel)).toEqual(['none', 'low', 'low', 'medium', 'medium', 'high', 'high']);
  });
});

describe('AvailabilityMonth', () => {
  const base = {
    month: '2026-10',
    counts: { '2026-10-10': 4, '2026-10-12': 9, '2026-10-20': 1, '2026-11-02': 3 },
    today: '2026-10-11',
    lastBookable: '2026-10-25',
    onMonthChange: () => {},
  };

  it('lets the booker pick only open days between today and the horizon', () => {
    const onSelect = vi.fn();
    render(<AvailabilityMonth {...base} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('gridcell', { name: /Monday 12 October: 9 open times/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-12');
    expect((screen.getByRole('gridcell', { name: /Saturday 10 October/ }) as HTMLButtonElement).disabled).toBe(true); // before today
    expect((screen.getByRole('gridcell', { name: /Tuesday 13 October: no open times/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('gridcell', { name: /Monday 12 October/ }).className).toContain('is-high');
  });

  it('stops paging at today and at the policy horizon', () => {
    const onMonthChange = vi.fn();
    render(<AvailabilityMonth {...base} onSelect={() => {}} onMonthChange={onMonthChange} />);

    expect((screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true); // horizon ends in October
  });

  it('says what went wrong and offers a retry', () => {
    const onRetry = vi.fn();
    render(<AvailabilityMonth {...base} onSelect={() => {}} error="The calendar is unavailable right now." onRetry={onRetry} />);

    expect(screen.getByRole("alert").textContent).toContain('The calendar is unavailable right now.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
