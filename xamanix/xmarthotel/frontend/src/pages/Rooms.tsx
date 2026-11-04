import { useEffect, useState } from 'react';
import { get, patch, errorMessage } from '../lib/api';
import { formatMoney } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Room, RoomType, RoomStatus } from '../lib/types';

const STATUSES: RoomStatus[] = ['Available', 'Occupied', 'Dirty', 'Cleaning', 'OutOfOrder'];

export default function Rooms() {
  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([get<Room[]>('/rooms'), get<RoomType[]>('/room-types')])
      .then(([r, t]) => { setRooms(r); setTypes(t); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeStatus = async (id: string, status: RoomStatus) => {
    try {
      await patch(`/rooms/${id}/status`, { status });
      setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.push('success', 'Room status updated');
    } catch (e) {
      toast.push('error', errorMessage(e));
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Rooms" subtitle={`${rooms.length} rooms across ${types.length} room types`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {types.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="font-semibold text-slate-800">{t.name}</div>
            <div className="text-brand-700 font-bold mt-1">{formatMoney(t.basePriceMinor)}<span className="text-xs font-normal text-slate-400"> / night</span></div>
            <div className="text-xs text-slate-400 mt-1">Sleeps {t.capacity} · {t.amenities.join(', ')}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        {rooms.length === 0 ? (
          <EmptyState message="No rooms configured yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Floor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Set status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.number}</td>
                  <td className="px-4 py-3 text-slate-600">{r.roomType?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.floor || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <select className="input max-w-[10rem] inline-block" value={r.status} onChange={(e) => changeStatus(r.id, e.target.value as RoomStatus)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
