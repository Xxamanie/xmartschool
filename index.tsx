import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getSupabaseClient } from './src/services/supabaseClient';

// Note: MSW Setup
// In a real environment with a public folder, we would start the worker here.
// import { worker } from './mocks/browser';
// if (process.env.NODE_ENV === 'development') {
//   worker.start();
// }
// For this sandbox, we use the 'services/api.ts' layer directly to ensure functionality
// without needing the mockServiceWorker.js static asset.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const renderApp = () => root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Supabase must consume its token fragment before HashRouter replaces it.
if (new URLSearchParams(window.location.search).get('recovery') === '1') {
  const client = getSupabaseClient();
  void (client?.auth.getSession() ?? Promise.resolve()).finally(() => {
    window.history.replaceState(null, '', `${window.location.pathname}#/reset-password`);
    renderApp();
  });
} else renderApp();

// Register the offline service worker in production builds only (avoids
// interfering with the Vite dev server / HMR).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
  });
}
