import { useEffect, useState, useCallback } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { PageHeader, Spinner, EmptyState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Reservation, Room } from '../lib/types';

export default function FrontDesk() {
  const toast = useToast();
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [inHouse, setInHouse] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkInFor, setCheckInFor] = useState<Reservation | null>(null);
  const [roomId, setRoomId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([get<Reservation[]>('/frontdesk/arrivals'), get<Reservation[]>('/frontdesk/in-house'), get<Room[]>('/rooms')])
      .then(([a, h, r]) => { setArrivals(a); setInHouse(h); setRooms(r); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const availableRooms = rooms.filter((r) => r.status === 'Available');

  const openCheckIn = (r: Reservation) => {
    setCheckInFor(r);
    setRoomId(availableRooms[0]?.id ?? '');
  };

  const confirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInFor || !roomId) return;
    setBusy(true);
    try {
      await post(`/frontdesk/${checkInFor.id}/check-in`, { roomId });
      toast.push('success', 'Guest checked in');
      setCheckInFor(null);
      load();
    } catch (err) {
      toast.push('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async (r: Reservation) => {
    try {
      await post(`/frontdesk/${r.id}/check-out`);
      toast.push('success', 'Guest checked out');
      load();
    } catch (e) {
      toast.push('error', errorMessage(e));
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Front Desk" subtitle="Arrivals and in-house guests" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Expected arrivals ({arrivals.length})</div>
          {arrivals.length === 0 ? <EmptyState message="No arrivals pending." /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {arrivals.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : '—'}</div>
                      <div className="text-xs text-slate-400">{r.roomType?.name} · {formatDate(r.checkIn)} → {formatDate(r.checkOut)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-primary" onClick={() => openCheckIn(r)} disabled={availableRooms.length === 0}>Check in</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">In-house ({inHouse.length})</div>
          {inHouse.length === 0 ? <EmptyState message="No guests currently in-house." /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {inHouse.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : '—'}</div>
                      <div className="text-xs text-slate-400">Room {r.room?.number ?? '—'} · departs {formatDate(r.checkOut)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost" onClick={() => checkOut(r)}>Check out</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <Modal open={!!checkInFor} onClose={() => setCheckInFor(null)} title="Assign room & check in">
        <form onSubmit={confirmCheckIn} className="space-y-4">
          <p className="text-sm text-slate-600">
            {checkInFor?.guest ? `${checkInFor.guest.firstName} ${checkInFor.guest.lastName}` : ''} — {checkInFor?.roomType?.name}
          </p>
          <div>
            <label className="label">Available room</label>
            <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
              {availableRooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} · {r.roomType?.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setCheckInFor(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || !roomId}>{busy ? 'Checking in…' : 'Confirm check-in'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
