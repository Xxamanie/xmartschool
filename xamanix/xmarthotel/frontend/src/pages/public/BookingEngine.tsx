import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get, post, errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import PublicShell from './PublicShell';

interface PublicProperty { id: string; name: string; city: string; country: string; currency: string; }
interface PublicRoomType { id: string; name: string; description: string; basePriceMinor: number; capacity: number; amenities: string[]; }
interface Confirmation { reference: string; reservationId: string; roomType: string; nights: number; totalMinor: number; checkIn: string; checkOut: string; }

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export default function BookingEngine() {
  const { propertyId: paramId } = useParams();
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(paramId ?? null);
  const [types, setTypes] = useState<PublicRoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    roomTypeId: '', checkIn: todayISO(), checkOut: plusDaysISO(1),
    firstName: '', lastName: '', phone: '', email: '', adults: 1, specialRequests: '',
  });

  const property = properties.find((p) => p.id === propertyId) ?? null;
  const currency = property?.currency ?? 'NGN';
  const selectedType = types.find((t) => t.id === form.roomTypeId) ?? null;
  const nights = Math.max(1, Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000));

  useEffect(() => {
    get<PublicProperty[]>('/public/properties')
      .then((list) => {
        setProperties(list);
        if (!propertyId && list.length === 1) setPropertyId(list[0].id);
      })
      .catch((e) => setErr(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!propertyId) return;
    get<PublicRoomType[]>(`/public/properties/${propertyId}/room-types`)
      .then((t) => { setTypes(t); setForm((f) => ({ ...f, roomTypeId: f.roomTypeId || t[0]?.id || '' })); })
      .catch((e) => setErr(errorMessage(e)));
  }, [propertyId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setSubmitting(true);
    setErr(null);
    try {
      const data = await post<Confirmation>(`/public/properties/${propertyId}/bookings`, {
        guest: { firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email || undefined },
        roomTypeId: form.roomTypeId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: form.adults,
        specialRequests: form.specialRequests || undefined,
      });
      setConfirmation(data);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setSubmitting(false);
    }
  };

  const payNow = async () => {
    if (!propertyId || !confirmation) return;
    try {
      const { authorizationUrl } = await post<{ authorizationUrl: string }>(`/public/properties/${propertyId}/reservations/${confirmation.reservationId}/pay`, {});
      window.location.href = authorizationUrl; // redirect to Paystack hosted checkout
    } catch (e) {
      setErr(errorMessage(e, 'Online payment is unavailable right now — you can pay on arrival.'));
    }
  };

  if (loading) return <PublicShell title="Book your stay"><p className="text-slate-400 text-sm">Loading…</p></PublicShell>;

  if (confirmation) {
    return (
      <PublicShell title={property?.name ?? 'Booking confirmed'} subtitle={property ? `${property.city}, ${property.country}` : undefined}>
        <div className="card p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-slate-900">Booking confirmed</h2>
          <p className="text-sm text-slate-500 mt-1">Your confirmation reference is</p>
          <div className="text-2xl font-mono font-bold text-brand-700 my-2 tracking-wide">{confirmation.reference}</div>
          <div className="text-sm text-slate-600 mt-4 space-y-1">
            <div>{confirmation.roomType} · {confirmation.nights} night(s)</div>
            <div>{formatDate(confirmation.checkIn)} → {formatDate(confirmation.checkOut)}</div>
            <div className="text-lg font-semibold text-slate-900 mt-2">{formatMoney(confirmation.totalMinor, currency)}</div>
          </div>
          {err && <p className="text-xs text-rose-600 mt-4">{err}</p>}
          <button className="btn-primary w-full mt-5" onClick={payNow}>Pay {formatMoney(confirmation.totalMinor, currency)} now</button>
          <p className="text-xs text-slate-400 mt-3">Prefer to pay later? You can settle on arrival — just keep your reference.</p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={property?.name ?? 'Book your stay'} subtitle={property ? `${property.city}, ${property.country}` : 'Direct booking — no commission'}>
      {err && <div className="card p-3 mb-4 text-sm text-rose-600 border-l-4 border-l-rose-500">{err}</div>}

      {!propertyId ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 mb-2">Choose a property to book:</p>
          {properties.map((p) => (
            <button key={p.id} onClick={() => setPropertyId(p.id)} className="card w-full text-left p-4 hover:bg-slate-50">
              <div className="font-semibold text-slate-800">{p.name}</div>
              <div className="text-xs text-slate-400">{p.city}, {p.country}</div>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="card p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Check-in</label><input type="date" className="input" value={form.checkIn} min={todayISO()} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} required /></div>
              <div><label className="label">Check-out</label><input type="date" className="input" value={form.checkOut} min={form.checkIn} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} required /></div>
            </div>
            <div>
              <label className="label">Room</label>
              <div className="space-y-2">
                {types.map((t) => (
                  <label key={t.id} className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer ${form.roomTypeId === t.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <span className="flex items-center gap-3">
                      <input type="radio" name="roomType" checked={form.roomTypeId === t.id} onChange={() => setForm({ ...form, roomTypeId: t.id })} />
                      <span>
                        <span className="block font-medium text-slate-800">{t.name}</span>
                        <span className="block text-xs text-slate-400">Sleeps {t.capacity}{t.amenities.length ? ` · ${t.amenities.join(', ')}` : ''}</span>
                      </span>
                    </span>
                    <span className="font-semibold text-slate-800 whitespace-nowrap">{formatMoney(t.basePriceMinor, currency)}<span className="text-xs font-normal text-slate-400">/night</span></span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Your details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">First name</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
              <div><label className="label">Last name</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
              <div><label className="label">Email (optional)</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><label className="label">Special requests (optional)</label><input className="input" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} placeholder="Late arrival, high floor…" /></div>
          </div>

          <div className="card p-5 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">{selectedType?.name} · {nights} night(s)</div>
              <div className="text-2xl font-bold text-slate-900">{selectedType ? formatMoney(selectedType.basePriceMinor * nights, currency) : '—'}</div>
            </div>
            <button type="submit" className="btn-primary" disabled={submitting || !form.roomTypeId}>{submitting ? 'Booking…' : 'Confirm booking'}</button>
          </div>
        </form>
      )}
    </PublicShell>
  );
}
