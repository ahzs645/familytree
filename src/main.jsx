/**
 * SPA entry point — mounts <App /> into #root.
 *
 * Import flows are intentionally explicit in production. Demo data and remote
 * URL imports are opt-in so a deployment cannot accidentally publish or replace
 * private family tree data.
 *
 * Rendering is never blocked on an import. The `?url=` deep-link flow lives in
 * components/RemoteDatasetLoader.jsx so the shell paints straight away and the
 * download has a progress bar and an error state instead of a blank page.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { autoLoadDemoDataIfEmpty } from './lib/remoteDataset.js';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${base.replace(/\/?$/, '/')}sw.js`).catch((error) => {
      console.warn('[CloudTreeWeb] service worker registration failed', error);
    });
  });
}

autoLoadDemoDataIfEmpty().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
