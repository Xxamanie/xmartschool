import { useEffect, useState } from 'react';
import { queuedCount } from '../lib/offline';

/** Thin status bar: shown when offline or while queued writes are pending. */
export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const poll = setInterval(() => { queuedCount().then(setPending); }, 2000);
    queuedCount().then(setPending);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(poll);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div className={`fixed bottom-0 inset-x-0 z-50 text-center text-sm py-2 ${online ? 'bg-brand-600 text-white' : 'bg-amber-500 text-white'}`}>
      {online
        ? `Back online — syncing ${pending} pending ${pending === 1 ? 'change' : 'changes'}…`
        : `You're offline. ${pending > 0 ? `${pending} ${pending === 1 ? 'change' : 'changes'} saved — will sync when you reconnect.` : 'Changes will be saved and synced when you reconnect.'}`}
    </div>
  );
}
