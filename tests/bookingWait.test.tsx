import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookingWaitPicker, type BookingWaitState } from '../src/components/BookingWaitPicker';
import { BookingWaitField } from '../src/components/BookingWaitField';

describe('BookingWaitPicker', () => {
  it('follows the standard wait, sets an own wait within the limit, and goes back', async () => {
    let state: BookingWaitState = { own: null, standard: 1440, max: 4320 };
    const save = vi.fn(async (minutes: number | null) => (state = { ...state, own: minutes }));
    render(<BookingWaitPicker adapter={{ load: async () => state, save }} title="Time before a new client's first call" />);

    expect(((await screen.findByLabelText('Use the standard wait (24 hours)')) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Save wait' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByLabelText('Set my own'));
    const hours = screen.getByLabelText('Hours');
    expect(screen.getByText('0 (none) to 3 days.')).toBeTruthy();

    // Above the limit: cannot be saved.
    fireEvent.change(hours, { target: { value: '73' } });
    expect(screen.getByRole('button', { name: 'Save wait' })).toHaveProperty('disabled', true);

    fireEvent.change(hours, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save wait' }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(0));
    await screen.findByText('Saved');

    fireEvent.click(screen.getByLabelText('Use the standard wait (24 hours)'));
    fireEvent.click(screen.getByRole('button', { name: 'Save wait' }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(null));
  });

  it('shows the service refusal', async () => {
    render(
      <BookingWaitPicker
        adapter={{ load: async () => ({ own: null, standard: 1440, max: 4320 }), save: async () => { throw new Error('A wait is whole minutes from 0 to 4320 (3 days).'); } }}
        title="Wait"
      />,
    );
    fireEvent.click(await screen.findByLabelText('Set my own'));
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save wait' }));
    expect((await screen.findByRole('alert')).textContent).toContain('3 days');
  });
});

describe('BookingWaitField', () => {
  it('starts at the usual wait, reports a different one for this booking only, and goes back', () => {
    const onChange = vi.fn();
    render(<BookingWaitField state={{ own: 2880, standard: 1440, max: 4320 }} value={null} onChange={onChange} />);

    expect(screen.getByText('Your usual wait is 48 hours. Change it here for this booking only.')).toBeTruthy();
    const hours = screen.getByLabelText('Hours before their first times open') as HTMLInputElement;
    expect(hours.value).toBe('48');

    fireEvent.change(hours, { target: { value: '12' } });
    expect(onChange).toHaveBeenLastCalledWith(720, true);
    expect(screen.getByText('Different from your usual wait, for this booking only.')).toBeTruthy();

    // Above the limit: not valid.
    fireEvent.change(hours, { target: { value: '73' } });
    expect(onChange).toHaveBeenLastCalledWith(null, false);

    fireEvent.change(hours, { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith(0, true);
    fireEvent.click(screen.getByRole('button', { name: 'Use my usual (48 hours)' }));
    expect(onChange).toHaveBeenLastCalledWith(null, true);
    expect(hours.value).toBe('48');
  });

  it('starts at the case value when one was chosen, and names the standard when the host follows it', () => {
    render(<BookingWaitField state={{ own: null, standard: 1440, max: 4320 }} value={0} onChange={() => {}} />);
    expect(screen.getByText('The standard wait you follow is 24 hours. Change it here for this booking only.')).toBeTruthy();
    expect((screen.getByLabelText('Hours before their first times open') as HTMLInputElement).value).toBe('0');
  });
});
