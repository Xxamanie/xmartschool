import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

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
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);