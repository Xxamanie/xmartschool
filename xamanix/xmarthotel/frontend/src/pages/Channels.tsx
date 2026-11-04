import { useEffect, useState } from 'react';
import { get, post, patch, errorMessage } from '../lib/api';
import { formatMoney, formatDateTime } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import type { RoomType } from '../lib/types';

interface Channel {
  id: string;
  type: 'BookingCom' | 'Expedia' | 'Airbnb' | 'Generic';
  name: string;
  status: 'Active' | 'Paused';
  ingestToken: string;
  hasCredentials: boolean;
  roomTypeMap: Record<string, string>; // otaCode -> roomTypeId
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMsg: string | null;
}
interface DayCell { date: string; available: number }
interface RoomTypeAvailability { roomTypeId: string; name: string; totalRooms: number; basePriceMinor: number; calendar: DayCell[] }

const TYPE_LABELS: Record<Channel['type'], string> = {
  BookingCom: 'Booking.com', Expedia: 'Expedia', Airbnb: 'Airbnb', Generic: 'Generic / Other',
};

export default function Channels() {
  const toast = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availability, setAvailability] = useState<RoomTypeAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ type: Channel['type']; name: string; codes: Record<string, string> }>({ type: 'BookingCom', name: '', codes: {} });

  const load = () => {
    Promise.all([
      get<Channel[]>('/channels'),
      get<RoomType[]>('/room-types'),
      get<RoomTypeAvailability[]>('/channels/availability'),
    ])
      .then(([c, rt, av]) => { setChannels(c); setRoomTypes(rt); setAvailability(av); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    // Invert per-room-type OTA codes into { otaCode: roomTypeId }, skipping blanks.
    const roomTypeMap: Record<string, string> = {};
    for (const rt of roomTypes) {
      const code = form.codes[rt.id]?.trim();
      if (code) roomTypeMap[code] = rt.id;
    }
    try {
      await post('/channels', { type: form.type, name: form.name, roomTypeMap });
      toast.push('success', 'Channel connected');
      setOpen(false);
      setForm({ type: 'BookingCom', name: '', codes: {} });
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const toggle = async (c: Channel) => {
    try {
      await patch(`/channels/${c.id}`, { status: c.status === 'Active' ? 'Paused' : 'Active' });
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
  };

  const sync = async (c: Channel) => {
    setSyncing(c.id);
    try {
      const r = await post<{ rows: number }>(`/channels/${c.id}/sync`);
      toast.push('success', `Synced ${r.rows} availability rows`);
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
    finally { setSyncing(null); }
  };

  const ingestUrl = (c: Channel) => `${window.location.origin}/api/channels/${c.id}/ingest?token=${c.ingestToken}`;
  const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => toast.push('info', 'Copied'), () => {}); };

  if (loading) return <Spinner />;

  const days = availability[0]?.calendar.slice(0, 14) ?? [];

  return (
    <>
      <PageHeader
        title="Channels"
        subtitle="Distribute availability to OTAs and ingest their bookings"
        action={<button className="btn-primary" onClick={() => setOpen(true)}>Connect channel</button>}
      />

      <div className="space-y-3 mb-8">
        {channels.length === 0 ? (
          <div className="card"><EmptyState message="No channels yet. Connect Booking.com, Expedia, Airbnb or a generic OTA." /></div>
        ) : channels.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="badge bg-slate-100 text-slate-600">{TYPE_LABELS[c.type]}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {c.lastSyncAt ? `Last sync ${formatDateTime(c.lastSyncAt)} · ${c.lastSyncMsg ?? ''}` : 'Never synced'}
                  {c.hasCredentials ? '' : ' · no credentials (computes, does not push live)'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Mapped rooms: {Object.keys(c.roomTypeMap).length || 0}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="btn-ghost" onClick={() => toggle(c)}>{c.status === 'Active' ? 'Pause' : 'Activate'}</button>
                <button className="btn-primary" onClick={() => sync(c)} disabled={syncing === c.id}>{syncing === c.id ? 'Syncing…' : 'Sync now'}</button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input className="input text-xs flex-1" readOnly value={ingestUrl(c)} />
              <button className="btn-ghost text-xs" onClick={() => copy(ingestUrl(c))}>Copy ingest URL</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Availability — next 14 nights</div>
        {availability.length === 0 ? <EmptyState message="No room types configured." /> : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium sticky left-0 bg-slate-50">Room type</th>
                  {days.map((d) => <th key={d.date} className="px-2 py-2 font-medium whitespace-nowrap">{d.date.slice(5)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {availability.map((rt) => (
                  <tr key={rt.roomTypeId}>
                    <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-white whitespace-nowrap">{rt.name} <span className="text-xs text-slate-400">({rt.totalRooms})</span></td>
                    {rt.calendar.slice(0, 14).map((c) => (
                      <td key={c.date} className={`px-2 py-2 text-center ${c.available === 0 ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>{c.available}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Connect a channel">
        <form onSubmit={createChannel} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">OTA</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Channel['type'] })}>
                {(Object.keys(TYPE_LABELS) as Channel['type'][]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className="label">Display name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Booking.com — Main" /></div>
          </div>
          <div>
            <label className="label">Map your room types to the OTA's room codes</label>
            <div className="space-y-2">
              {roomTypes.map((rt) => (
                <div key={rt.id} className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 w-40 truncate">{rt.name} · {formatMoney(rt.basePriceMinor)}</span>
                  <input className="input flex-1" placeholder="OTA room code" value={form.codes[rt.id] ?? ''} onChange={(e) => setForm({ ...form, codes: { ...form.codes, [rt.id]: e.target.value } })} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Leave blank to skip a room type. Codes are how the OTA identifies each room in its bookings.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Connect</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
