import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CloudUpload } from 'lucide-react';
import { queuedCount, flushQueue } from '../src/utils/offlineQueue';

/** Floating indicator: shows offline state and how many writes await sync. */
export const OfflineBadge: React.FC = () => {
  const [count, setCount] = useState<number>(typeof window !== 'undefined' ? queuedCount() : 0);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const upd = () => setCount(queuedCount());
    const goOnline = () => { setOnline(true); upd(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('xss-queue-changed', upd);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('xss-queue-changed', upd);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online && count === 0) return null;

  const sync = async () => { setSyncing(true); await flushQueue(); setSyncing(false); };

  return (
    <div className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg text-xs font-bold border ${online ? 'bg-white border-amber-300 text-amber-700' : 'bg-slate-900 border-slate-700 text-amber-300'}`}>
      {online ? <CloudUpload size={14} /> : <WifiOff size={14} />}
      {online
        ? <span>{count} change{count === 1 ? '' : 's'} pending sync</span>
        : <span>Offline{count > 0 ? ` · ${count} queued` : ''}</span>}
      {online && count > 0 && (
        <button onClick={sync} disabled={syncing} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60">
          <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} /> Sync
        </button>
      )}
    </div>
  );
};
