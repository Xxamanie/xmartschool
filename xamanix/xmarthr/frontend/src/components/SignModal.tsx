import { useRef, useState } from 'react';
import { Modal } from './ui';

/** Reusable e-signature capture — typed name or drawn signature (canvas). */
export default function SignModal({ open, onClose, onSign }: { open: boolean; onClose: () => void; onSign: (method: 'Typed' | 'Drawn', name: string, image?: string) => void }) {
  const [tab, setTab] = useState<'Typed' | 'Drawn'>('Typed');
  const [name, setName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { drawing.current = true; const ctx = canvasRef.current!.getContext('2d')!; const p = at(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = canvasRef.current!.getContext('2d')!; const p = at(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); };

  const submit = () => {
    if (!name.trim()) return;
    if (tab === 'Typed') onSign('Typed', name.trim());
    else onSign('Drawn', name.trim(), canvasRef.current?.toDataURL('image/png'));
  };

  return (
    <Modal open={open} onClose={onClose} title="Sign document">
      <div className="space-y-4">
        <div className="flex gap-2 text-sm">
          <button className={`px-3 py-1 rounded-lg ${tab === 'Typed' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`} onClick={() => setTab('Typed')}>Type</button>
          <button className={`px-3 py-1 rounded-lg ${tab === 'Drawn' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`} onClick={() => setTab('Drawn')}>Draw</button>
        </div>
        <div><label className="label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full legal name" /></div>
        {tab === 'Drawn' && (
          <div>
            <label className="label">Signature</label>
            <canvas ref={canvasRef} width={440} height={140} className="border border-slate-300 rounded-lg w-full touch-none bg-white" onPointerDown={down} onPointerMove={draw} onPointerUp={up} onPointerLeave={up} />
            <button type="button" className="text-xs text-slate-500 mt-1 hover:underline" onClick={clear}>Clear</button>
          </div>
        )}
        <p className="text-xs text-slate-400">By signing you agree this constitutes your electronic signature. A tamper-evident hash of the document is stored with your name and timestamp.</p>
        <div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}>Sign</button></div>
      </div>
    </Modal>
  );
}
