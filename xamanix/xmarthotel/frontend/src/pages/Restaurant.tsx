import { useEffect, useState } from 'react';
import { get, post, patch, errorMessage } from '../lib/api';
import { formatMoney, toMinor } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import type { MenuItem, KitchenOrder } from '../lib/types';

const ORDER_NEXT: Record<string, KitchenOrder['status'] | undefined> = { Open: 'Preparing', Preparing: 'Served' };

export default function Restaurant() {
  const toast = useToast();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [menuModal, setMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: '', category: 'Food', price: '' });

  const [orderModal, setOrderModal] = useState(false);
  const [table, setTable] = useState('');
  const [cart, setCart] = useState<{ menuItemId: string; quantity: number }[]>([]);
  const [pick, setPick] = useState({ menuItemId: '', quantity: '1' });

  const load = () => {
    Promise.all([get<MenuItem[]>('/restaurant/menu'), get<KitchenOrder[]>('/restaurant/orders')])
      .then(([m, o]) => { setMenu(m); setOrders(o); if (m[0]) setPick((p) => ({ ...p, menuItemId: p.menuItemId || m[0].id })); })
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/restaurant/menu', { name: menuForm.name, category: menuForm.category, priceMinor: toMinor(menuForm.price) });
      toast.push('success', 'Menu item added');
      setMenuModal(false);
      setMenuForm({ name: '', category: 'Food', price: '' });
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const addToCart = () => {
    if (!pick.menuItemId) return;
    setCart((c) => {
      const existing = c.find((x) => x.menuItemId === pick.menuItemId);
      const qty = Math.max(1, Number(pick.quantity) || 1);
      if (existing) return c.map((x) => (x.menuItemId === pick.menuItemId ? { ...x, quantity: x.quantity + qty } : x));
      return [...c, { menuItemId: pick.menuItemId, quantity: qty }];
    });
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) { toast.push('info', 'Add at least one item'); return; }
    try {
      await post('/restaurant/orders', { tableLabel: table || undefined, items: cart });
      toast.push('success', 'Order placed');
      setOrderModal(false); setCart([]); setTable('');
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const advance = async (o: KitchenOrder) => {
    const next = ORDER_NEXT[o.status];
    if (!next) return;
    try {
      await patch(`/restaurant/orders/${o.id}`, { status: next });
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
  };

  const menuName = (id: string) => menu.find((m) => m.id === id)?.name ?? id;
  const orderTotal = (o: KitchenOrder) => o.items.reduce((s, it) => s + it.priceMinor * it.quantity, 0);

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Restaurant"
        subtitle="Menu and kitchen orders"
        action={<div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setMenuModal(true)}>Add menu item</button>
          <button className="btn-primary" onClick={() => setOrderModal(true)} disabled={menu.length === 0}>New order</button>
        </div>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Menu ({menu.length})</div>
          {menu.length === 0 ? <EmptyState message="No menu items yet." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {menu.map((m) => (
                <li key={m.id} className="px-4 py-3 flex justify-between">
                  <span className="text-slate-700">{m.name}<span className="text-xs text-slate-400"> · {m.category}</span></span>
                  <span className="text-slate-800 font-medium">{formatMoney(m.priceMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Orders ({orders.length})</div>
          {orders.length === 0 ? <EmptyState message="No orders yet." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {orders.map((o) => (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-slate-800">{o.tableLabel || (o.reservationId ? 'Room service' : 'Walk-in')} · {formatMoney(orderTotal(o))}</div>
                      <div className="text-xs text-slate-400">{o.items.map((it) => `${it.quantity}× ${it.menuItem?.name ?? menuName('')}`).join(', ')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      {ORDER_NEXT[o.status] && <button className="btn-ghost" onClick={() => advance(o)}>{o.status === 'Open' ? 'Prepare' : 'Serve'}</button>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal open={menuModal} onClose={() => setMenuModal(false)} title="Add menu item">
        <form onSubmit={addMenuItem} className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category</label>
              <select className="input" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}>
                {['Food', 'Drink', 'Dessert', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Price</label><input className="input" type="number" min="0" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setMenuModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="New order">
        <form onSubmit={submitOrder} className="space-y-4">
          <div><label className="label">Table / note (optional)</label><input className="input" value={table} onChange={(e) => setTable(e.target.value)} placeholder="e.g. Table 4" /></div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><label className="label">Item</label>
              <select className="input" value={pick.menuItemId} onChange={(e) => setPick({ ...pick, menuItemId: e.target.value })}>
                {menu.map((m) => <option key={m.id} value={m.id}>{m.name} — {formatMoney(m.priceMinor)}</option>)}
              </select>
            </div>
            <div className="w-20"><label className="label">Qty</label><input className="input" type="number" min="1" value={pick.quantity} onChange={(e) => setPick({ ...pick, quantity: e.target.value })} /></div>
            <button type="button" className="btn-ghost" onClick={addToCart}>Add</button>
          </div>
          {cart.length > 0 && (
            <ul className="text-sm border border-slate-200 rounded-lg divide-y divide-slate-100">
              {cart.map((c) => (
                <li key={c.menuItemId} className="px-3 py-2 flex justify-between">
                  <span className="text-slate-700">{c.quantity}× {menuName(c.menuItemId)}</span>
                  <button type="button" className="text-rose-600 text-xs hover:underline" onClick={() => setCart((cc) => cc.filter((x) => x.menuItemId !== c.menuItemId))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOrderModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Place order</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
