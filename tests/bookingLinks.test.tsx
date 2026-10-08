import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BookingLinksManager, type BookingLinksAdapter } from '../src/components/BookingLinksManager';
import type { BookingLink } from '../src/components/BookingLinkEditor';

const LIMITS = { durations: [15, 30, 60], minBuffer: 5, maxBuffer: 120, maxDaysAhead: 365 };

const link = (over: Partial<BookingLink> = {}): BookingLink => ({
  ref: 'link:1', host: 'auth-1', name: 'Initial Consultation', description: null, color: '#3b82f6', slug: 'initial-consultation',
  is_active: true, is_default: true, external_url: null, duration: 30, buffer_before: null, buffer_after: null, daily_cap: null, days_ahead: 60,
  ...over,
});

function adapterWith(rows: BookingLink[]): BookingLinksAdapter & { rows: BookingLink[] } {
  const a = {
    rows,
    list: vi.fn(async () => a.rows),
    create: vi.fn(async (f) => {
      const l = link({ ...f, ref: 'link:new', slug: f.slug ?? 'new', is_default: false });
      a.rows = [...a.rows, l];
      return l;
    }),
    update: vi.fn(async (ref: string, f) => {
      a.rows = a.rows.map((r) => (r.ref === ref ? { ...r, ...f } : r));
      return a.rows.find((r) => r.ref === ref)!;
    }),
    setDefault: vi.fn(async (ref: string) => a.rows.find((r) => r.ref === ref)!),
    remove: vi.fn(async (ref: string) => {
      a.rows = a.rows.filter((r) => r.ref !== ref);
    }),
  };
  return a;
}

beforeAll(() => {
  // jsdom has no modal dialogs.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('BookingLinksManager', () => {
  it('lists links with one kebab per row and the product action in it', async () => {
    const send = vi.fn();
    render(<BookingLinksManager adapter={adapterWith([link()])} limits={LIMITS} actions={[{ label: 'Send to client', onSelect: send }]} />);

    expect(await screen.findByText('Initial Consultation')).toBeTruthy();
    expect(screen.getByText('Default')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Initial Consultation' }));
    const items = screen.getAllByRole('menuitem').map((b) => b.textContent);
    expect(items).toEqual(['Edit', 'Copy reference', 'Send to client', 'Switch off', 'Delete']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send to client' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ref: 'link:1' }));
  });

  it('edits a link in the dialog, sending only the policy-limited fields', async () => {
    const a = adapterWith([link()]);
    const notice = vi.fn();
    render(<BookingLinksManager adapter={a} limits={LIMITS} onNotice={notice} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Initial Consultation' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getAllByRole('option').map((o) => o.textContent)).toEqual(['15 min', '30 min', '60 min']);
    fireEvent.change(within(dlg).getByLabelText('Bookable up to (days ahead)'), { target: { value: '7' } });
    fireEvent.change(within(dlg).getByLabelText('Most bookings a day'), { target: { value: '3' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(a.update).toHaveBeenCalledTimes(1));
    expect(a.update.mock.calls[0]![1]).toMatchObject({ days_ahead: 7, daily_cap: 3, duration: 30, buffer_before: null });
    await waitFor(() => expect(notice).toHaveBeenCalledWith('Link saved'));
  });

  it('shows every reason a save was refused, inside the dialog', async () => {
    const a = adapterWith([]);
    a.create.mockRejectedValueOnce(Object.assign(new Error('The link cannot be saved.'), { errors: ['Choose a length of 15, 30, 60 minutes.'] }));
    render(<BookingLinksManager adapter={a} limits={LIMITS} />);

    expect(await screen.findByText('No booking links yet. Create one to start taking bookings.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Name'), { target: { value: 'Quick question' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create link' }));

    expect(await within(dlg).findByRole('alert')).toHaveProperty('textContent', 'The link cannot be saved. Choose a length of 15, 30, 60 minutes.');
  });

  it('deletes only after the confirm says yes', async () => {
    const a = adapterWith([link()]);
    const confirm = vi.fn(async () => false);
    render(<BookingLinksManager adapter={a} limits={LIMITS} confirmDelete={confirm} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Initial Consultation' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(a.remove).not.toHaveBeenCalled();
  });
});
