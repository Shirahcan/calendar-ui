import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HolidayEditor } from '../src/components/HolidayEditor';
import { useHolidayEditor, type HolidayRow } from '../src/hooks/useHolidayEditor';

/** An in-memory service: the same rules as calendar-service's HolidayController. */
function service(initial: HolidayRow[]) {
  let rows = [...initial];
  return {
    rows: () => rows,
    load: vi.fn(async (region: string, year: number) => rows.filter((r) => r.region === region && r.date.startsWith(String(year)))),
    put: vi.fn(async (region: string, date: string, name: string) => {
      rows = [...rows.filter((r) => r.date !== date), { region, date, name, source: 'manual', observed: true, status: 'confirmed' as const }];
    }),
    remove: vi.fn(async (_region: string, date: string) => {
      rows = rows.map((r) => (r.date === date ? { ...r, observed: false, source: 'manual' } : r));
    }),
    confirm: vi.fn(async (_region: string, date: string) => {
      rows = rows.map((r) => (r.date === date ? { ...r, status: 'confirmed' as const } : r));
    }),
    reject: vi.fn(async (_region: string, date: string) => {
      rows = rows.map((r) => (r.date === date ? { ...r, status: 'rejected' as const } : r));
    }),
  };
}

function Harness({ svc, confirmRemove }: { svc: ReturnType<typeof service>; confirmRemove?: (row: HolidayRow, q: string) => Promise<boolean> }) {
  const editor = useHolidayEditor({ initialRegion: 'NG', initialYear: 2027, ...svc });
  return <HolidayEditor editor={editor} regions={[{ code: 'NG', label: 'Nigeria' }, { code: 'CA', label: 'Canada' }]} confirmRemove={confirmRemove} />;
}

const base: HolidayRow[] = [
  { region: 'NG', date: '2027-01-01', name: "New Year's Day", source: 'computed', observed: true, status: 'confirmed' },
  { region: 'NG', date: '2027-04-13', name: 'Eid al-Fitr', source: 'porter', observed: true, status: 'proposed', estimated: true, sources: [{ url: 'https://example.test/eid', domain: 'example.test' }] },
];

describe('HolidayEditor', () => {
  it('shows a researched date as waiting, and confirming moves it into the holidays', async () => {
    const svc = service(base);
    render(<Harness svc={svc} />);

    expect(await screen.findByText('Waiting for review')).toBeTruthy();
    expect(screen.getByText('Estimated')).toBeTruthy();
    expect(screen.getByText('example.test').getAttribute('href')).toBe('https://example.test/eid');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.queryByText('Waiting for review')).toBeNull());
    expect(svc.confirm).toHaveBeenCalledWith('NG', '2027-04-13');
    expect(screen.getByText('Eid al-Fitr')).toBeTruthy();
  });

  it('asks before removing, and a removed holiday can be put back', async () => {
    const svc = service(base);
    const confirmRemove = vi.fn().mockResolvedValue(true);
    render(<Harness svc={svc} confirmRemove={confirmRemove} />);

    await screen.findByText("New Year's Day");
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(svc.remove).toHaveBeenCalledWith('NG', '2027-01-01'));
    expect(confirmRemove.mock.calls[0]?.[1]).toContain('will not put it back');
    expect(await screen.findByText('Removed or rejected')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Put back' }));
    await waitFor(() => expect(svc.put).toHaveBeenCalledWith('NG', '2027-01-01', "New Year's Day"));
  });

  it('does not remove when the person says no', async () => {
    const svc = service(base);
    render(<Harness svc={svc} confirmRemove={async () => false} />);

    await screen.findByText("New Year's Day");
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(svc.remove).not.toHaveBeenCalled();
  });

  it('adds a holiday the formula cannot compute', async () => {
    const svc = service(base);
    const { container } = render(<Harness svc={svc} />);
    await screen.findByText("New Year's Day");

    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2027-05-16' } });
    fireEvent.change(container.querySelector('input[type="text"]')!, { target: { value: 'Eid al-Adha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(svc.put).toHaveBeenCalledWith('NG', '2027-05-16', 'Eid al-Adha'));
    expect(await screen.findByText('Eid al-Adha')).toBeTruthy();
  });

  it('loads the next year when asked', async () => {
    const svc = service(base);
    render(<Harness svc={svc} />);
    await screen.findByText("New Year's Day");

    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    await waitFor(() => expect(svc.load).toHaveBeenLastCalledWith('NG', 2028));
    expect(await screen.findByText('No holidays for this year yet.')).toBeTruthy();
  });
});
