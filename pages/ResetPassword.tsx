import React, { useEffect, useState } from 'react';
import { supabaseAuthService } from '../src/services/supabaseAuthService';
import { getSupabaseClient } from '../src/services/supabaseClient';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Open the recovery link from your email to continue.');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { setReady(true); setMessage('Choose your new password.'); }
    });
    void client.auth.getSession().then(({ data }) => { if (data.session) { setReady(true); setMessage('Choose your new password.'); } });
    return () => data.subscription.unsubscribe();
  }, []);
  return <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
    <form className="w-full max-w-md bg-white p-8 rounded-xl shadow space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (password !== confirmation) { setMessage('Passwords must match.'); return; }
      setBusy(true);
      try { await supabaseAuthService.updatePassword(password); setMessage('Password updated. You can sign in with your new password.'); setReady(false); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update password.'); }
      finally { setBusy(false); }
    }}>
      <h1 className="text-xl font-semibold">Reset password</h1>
      <p role="status">{message}</p>
      {ready && <>
        <label className="block">New password<input className="block w-full border rounded p-2" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="block">Confirm password<input className="block w-full border rounded p-2" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        <button disabled={busy} className="bg-primary-600 text-white rounded px-4 py-2">{busy ? 'Saving...' : 'Update password'}</button>
      </>}
      <a className="block text-primary-600" href="#/login">Return to login</a>
    </form>
  </main>;
};
