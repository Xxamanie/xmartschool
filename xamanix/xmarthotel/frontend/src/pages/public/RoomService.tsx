import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { get, post, errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import PublicShell from './PublicShell';

interface PublicProperty { id: string; name: string; currency: string; }
interface PublicMenuItem { id: string; name: string; category: string; priceMinor: number; }
interface OrderResult { reference: string; postedToFolio: boolean; matchedReservation: boolean; }

export default function RoomService() {
  const { propertyId } = useParams();
  const [searchParams] = useSearchParams();
  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [menu, setMenu] = useState<PublicMenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [roomNumber, setRoomNumber] = useState(searchParams.get('room') ?? '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const currency = property?.currency ?? 'NGN';

  useEffect(() => {
    if (!propertyId) { setErr('Missing property'); setLoading(false); return; }
    Promise.all([
      get<PublicProperty[]>('/public/properties'),
      get<PublicMenuItem[]>(`/public/properties/${propertyId}/menu`),
    ])
      .then(([props, items]) => { setProperty(props.find((p) => p.id === propertyId) ?? null); setMenu(items); })
      .catch((e) => setErr(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const setQty = (id: string, qty: number) => setCart((c) => {
    const next = { ...c };
    if (qty <= 0) delete next[id]; else next[id] = qty;
    return next;
  });

  const lines = Object.entries(cart).map(([id, qty]) => ({ item: menu.find((m) => m.id === id)!, qty })).filter((l) => l.item);
  const total = lines.reduce((s, l) => s + l.item.priceMinor * l.qty, 0);

  const categories = Array.from(new Set(menu.map((m) => m.category)));

  const submit = async () => {
    if (!propertyId || lines.length === 0 || !roomNumber.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      const data = await post<OrderResult>(`/public/properties/${propertyId}/room-service`, {
        roomNumber: roomNumber.trim(),
        items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
        note: note || undefined,
      });
      setResult(data);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PublicShell title="Room service"><p className="text-slate-400 text-sm">Loading menu…</p></PublicShell>;

  if (result) {
    return (
      <PublicShell title={property?.name ?? 'Room service'} subtitle={`Room ${roomNumber}`}>
        <div className="card p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-slate-900">Order received</h2>
          <div className="text-2xl font-mono font-bold text-brand-700 my-2">{result.reference}</div>
          <p className="text-sm text-slate-500">
            {result.postedToFolio
              ? 'Charged to your room — settle on check-out.'
              : 'Our team will confirm payment with you shortly.'}
          </p>
          <button className="btn-ghost mt-5" onClick={() => { setResult(null); setCart({}); setNote(''); }}>Place another order</button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={property?.name ?? 'Room service'} subtitle="Order to your room">
      {err && <div className="card p-3 mb-4 text-sm text-rose-600 border-l-4 border-l-rose-500">{err}</div>}

      <div className="card p-4 mb-4">
        <label className="label">Room number</label>
        <input className="input" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="e.g. 201" />
      </div>

      {menu.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-400">No menu items available right now.</div>
      ) : (
        categories.map((cat) => (
          <div key={cat} className="mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{cat}</h3>
            <div className="card divide-y divide-slate-100">
              {menu.filter((m) => m.category === cat).map((m) => {
                const qty = cart[m.id] ?? 0;
                return (
                  <div key={m.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium text-slate-800">{m.name}</div>
                      <div className="text-sm text-slate-500">{formatMoney(m.priceMinor, currency)}</div>
                    </div>
                    {qty === 0 ? (
                      <button className="btn-ghost" onClick={() => setQty(m.id, 1)}>Add</button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button className="btn-ghost px-2.5" onClick={() => setQty(m.id, qty - 1)}>−</button>
                        <span className="w-5 text-center font-medium">{qty}</span>
                        <button className="btn-ghost px-2.5" onClick={() => setQty(m.id, qty + 1)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {lines.length > 0 && (
        <div className="sticky bottom-4 mt-6">
          <div className="card p-4 shadow-md">
            <input className="input mb-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the kitchen (optional)" />
            <button className="btn-primary w-full" onClick={submit} disabled={submitting || !roomNumber.trim()}>
              {submitting ? 'Sending…' : `Order · ${formatMoney(total, currency)}`}
            </button>
          </div>
        </div>
      )}
    </PublicShell>
  );
}
