import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReminderPolicyEditor, type ReminderPolicy } from '../src/components/ReminderPolicyEditor';
import { reminderLeadLabel } from '../src/theme';

/** An in-memory service with calendar-service's rules (sorted, de-duplicated). */
function service(initial: number[] | null) {
  let custom = initial;
  const policy = (): ReminderPolicy => ({ offsets_minutes: custom ?? [1440, 60, 30], is_default: custom === null, default_offsets_minutes: [1440, 60, 30] });
  return {
    load: vi.fn(async () => policy()),
    save: vi.fn(async (xs: number[] | null) => {
      custom = xs === null ? null : [...new Set(xs)].sort((a, b) => b - a);
      return policy();
    }),
  };
}

describe('reminderLeadLabel', () => {
  it('reads like a person would say it', () => {
    expect(reminderLeadLabel(1440)).toBe('1 day');
    expect(reminderLeadLabel(2880)).toBe('2 days');
    expect(reminderLeadLabel(60)).toBe('1 hour');
    expect(reminderLeadLabel(90)).toBe('1 hour 30 minutes');
    expect(reminderLeadLabel(15)).toBe('15 minutes');
  });
});

describe('ReminderPolicyEditor', () => {
  it('shows the standard times, adds one and saves the new list', async () => {
    const svc = service(null);
    render(<ReminderPolicyEditor adapter={svc} />);

    await screen.findByText('1 day before');
    expect(screen.getByText('These are the standard times.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('How long before'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('2 hours before')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove the reminder 30 minutes before' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save reminder times' }));

    await waitFor(() => expect(svc.save).toHaveBeenCalledWith([1440, 120, 60]));
    await screen.findByText('Saved');
    expect(screen.getByRole('button', { name: 'Use the standard times' })).toBeTruthy();
  });

  it('refuses a time outside the service limits instead of sending it', async () => {
    const svc = service([60]);
    render(<ReminderPolicyEditor adapter={svc} />);
    await screen.findByText('1 hour before');

    fireEvent.change(screen.getByLabelText('How long before'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('A reminder must be between 1 minute and 7 days before.')).toBeTruthy();
    expect(svc.save).not.toHaveBeenCalled();
  });

  it('puts the standard times back in one step', async () => {
    const svc = service([15]);
    render(<ReminderPolicyEditor adapter={svc} />);
    await screen.findByText('15 minutes before');

    fireEvent.click(screen.getByRole('button', { name: 'Use the standard times' }));
    await waitFor(() => expect(svc.save).toHaveBeenCalledWith(null));
    await screen.findByText('These are the standard times.');
    expect(screen.getByText('1 day before')).toBeTruthy();
  });

  it('says what went wrong when it cannot load', async () => {
    render(<ReminderPolicyEditor adapter={{ load: async () => { throw new Error('The calendar service is unreachable.'); }, save: vi.fn() }} />);
    expect((await screen.findByRole('alert')).textContent).toBe('The calendar service is unreachable.');
  });
});
