import { useEffect, useRef, useState, useCallback } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Reservation, RoomType, Guest } from '../lib/types';

const todayISO = () => new Date().toISOString().slice(0, 10);
const tomorrowISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

export default function Reservations() {
  const toast = useToast();
  const [list, setList] = useState<Reservation[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Guest search state
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '',
    roomTypeId: '', checkIn: todayISO(), checkOut: tomorrowISO(), source: 'Walk-in',
  });

  const load = useCallback(() => {
    Promise.all([get<Reservation[]>('/reservations'), get<RoomType[]>('/room-types')])
      .then(([r, t]) => { setList(r); setTypes(t); if (t[0]) setForm((f) => ({ ...f, roomTypeId: f.roomTypeId || t[0].id })); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Debounced guest search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!guestQuery.trim()) { setGuestResults([]); setShowDropdown(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await get<Guest[]>('/guests', { q: guestQuery.trim() });
        setGuestResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        // search errors are non-critical; don't toast
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [guestQuery]);

  const selectGuest = (g: Guest) => {
    setSelectedGuest(g);
    setForm((f) => ({ ...f, firstName: g.firstName, lastName: g.lastName, phone: g.phone ?? '' }));
    setGuestQuery(`${g.firstName} ${g.lastName}`);
    setShowDropdown(false);
  };

  const clearGuestSelection = () => {
    setSelectedGuest(null);
    setGuestQuery('');
    setForm((f) => ({ ...f, firstName: '', lastName: '', phone: '' }));
  };

  const resetForm = () => {
    clearGuestSelection();
    setForm((f) => ({ ...f, firstName: '', lastName: '', phone: '' }));
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(form.checkOut) <= new Date(form.checkIn)) {
      toast.push('error', 'Check-out must be after check-in');
      return;
    }
    setBusy(true);
    try {
      const payload = selectedGuest
        ? { guestId: selectedGuest.id, roomTypeId: form.roomTypeId, checkIn: form.checkIn, checkOut: form.checkOut, source: form.source }
        : { guest: { firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined }, roomTypeId: form.roomTypeId, checkIn: form.checkIn, checkOut: form.checkOut, source: form.source };
      await post('/reservations', payload);
      toast.push('success', 'Reservation created');
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      toast.push('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancel this reservation? This cannot be undone.')) return;
    try {
      await post(`/reservations/${id}/cancel`);
      toast.push('success', 'Reservation cancelled');
      setList((l) => l.map((r) => (r.id === id ? { ...r, status: 'Cancelled' } : r)));
    } catch (e) {
      toast.push('error', errorMessage(e));
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Reservations"
        subtitle={`${list.length} bookings`}
        action={<button className="btn-primary" onClick={() => setOpen(true)}>New reservation</button>}
      />

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState message="No reservations yet. Create the first booking." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Room type</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Check-out</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.roomType?.name ?? '—'}{r.room ? ` · Rm ${r.room.number}` : ''}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.checkIn)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.checkOut)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'Booked' && (
                      <button className="text-rose-600 hover:underline text-sm" onClick={() => cancel(r.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="New reservation">
        <form onSubmit={create} className="space-y-4">
          {/* Guest search */}
          <div className="relative">
            <label className="label">Search existing guest</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Name or phone…"
                value={guestQuery}
                onChange={(e) => { setGuestQuery(e.target.value); if (selectedGuest) clearGuestSelection(); }}
                autoComplete="off"
              />
              {selectedGuest && (
                <button type="button" className="btn-ghost text-xs px-2" onClick={clearGuestSelection}>Clear</button>
              )}
            </div>
            {selectedGuest && (
              <p className="text-xs text-emerald-600 mt-1">
                Using existing guest — {selectedGuest.loyaltyTier !== 'None' ? `${selectedGuest.loyaltyTier} loyalty · ` : ''}stay history preserved.
              </p>
            )}
            {showDropdown && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-auto text-sm">
                {guestResults.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                      onClick={() => selectGuest(g)}
                    >
                      <span className="font-medium text-slate-800">{g.firstName} {g.lastName}</span>
                      {g.phone && <span className="text-slate-400 ml-2">{g.phone}</span>}
                      {g.loyaltyTier !== 'None' && <span className="ml-2 text-xs text-brand-600">{g.loyaltyTier}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* New guest fields — shown when no existing guest selected */}
          {!selectedGuest && (
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs text-slate-400">No match? Fill in new guest details below.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First name</label>
                  <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Room type</label>
            <select className="input" value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })} required>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Check-in</label>
              <input type="date" className="input" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} required />
            </div>
            <div>
              <label className="label">Check-out</label>
              <input type="date" className="input" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {['Walk-in', 'Phone', 'Online', 'OTA'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create reservation'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
