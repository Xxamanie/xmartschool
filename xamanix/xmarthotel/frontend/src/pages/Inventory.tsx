import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { PageHeader, Spinner, EmptyState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import type { InventoryItem } from '../lib/types';

export default function Inventory() {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModal, setItemModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Consumable', unit: 'unit', quantity: '0', reorderLevel: '0' });
  const [moveFor, setMoveFor] = useState<InventoryItem | null>(null);
  const [move, setMove] = useState({ change: '', reason: '' });

  const load = () => {
    get<InventoryItem[]>('/inventory/items')
      .then(setItems)
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/inventory/items', {
        name: form.name, category: form.category, unit: form.unit,
        quantity: Number(form.quantity) || 0, reorderLevel: Number(form.reorderLevel) || 0,
      });
      toast.push('success', 'Item added');
      setItemModal(false);
      setForm({ name: '', category: 'Consumable', unit: 'unit', quantity: '0', reorderLevel: '0' });
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const applyMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveFor) return;
    const change = Number(move.change);
    if (!change) { toast.push('info', 'Enter a non-zero change'); return; }
    try {
      await post(`/inventory/items/${moveFor.id}/movement`, { change, reason: move.reason || undefined });
      toast.push('success', 'Stock updated');
      setMoveFor(null); setMove({ change: '', reason: '' });
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${items.length} items · ${items.filter((i) => i.lowStock).length} low on stock`}
        action={<button className="btn-primary" onClick={() => setItemModal(true)}>Add item</button>}
      />

      <div className="card overflow-hidden">
        {items.length === 0 ? <EmptyState message="No inventory items yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">On hand</th>
                <th className="px-4 py-3 font-medium text-right">Reorder at</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id} className={i.lowStock ? 'bg-amber-50/50' : ''}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {i.name}
                    {i.lowStock && <span className="badge bg-amber-100 text-amber-700 ml-2">Low</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.category}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{i.quantity} {i.unit}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{i.reorderLevel}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost" onClick={() => { setMoveFor(i); setMove({ change: '', reason: '' }); }}>Adjust</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={itemModal} onClose={() => setItemModal(false)} title="Add inventory item">
        <form onSubmit={addItem} className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Consumable', 'Linen', 'Amenity', 'Equipment', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Unit</label><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Opening quantity</label><input className="input" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div><label className="label">Reorder level</label><input className="input" type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setItemModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add item</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!moveFor} onClose={() => setMoveFor(null)} title={`Adjust stock — ${moveFor?.name ?? ''}`}>
        <form onSubmit={applyMovement} className="space-y-4">
          <p className="text-sm text-slate-500">Use a positive number to receive stock, negative to consume. Current: {moveFor?.quantity} {moveFor?.unit}.</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Change</label><input className="input" type="number" value={move.change} onChange={(e) => setMove({ ...move, change: e.target.value })} placeholder="e.g. -5 or 20" required /></div>
            <div><label className="label">Reason</label><input className="input" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} placeholder="Restock / Used" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setMoveFor(null)}>Cancel</button>
            <button type="submit" className="btn-primary">Apply</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
