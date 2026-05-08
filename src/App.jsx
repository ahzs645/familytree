/**
 * Top-level React SPA. BrowserRouter + shared providers + AppShell outlet.
 *
 * Routes are declared as data in routes/manifest.js and unrolled here.
 * Each leaf is React.lazy() so the landing route stays small.
 */
import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { ActivePersonProvider } from './contexts/ActivePersonContext.jsx';
import { DatabaseStatusProvider } from './contexts/DatabaseStatusContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { ModalProvider } from './contexts/ModalContext.jsx';
import { LocalizationProvider, useTranslation } from './contexts/LocalizationContext.jsx';
import Home from './routes/Home.jsx';
import { startBackupScheduler } from './lib/backup.js';
import { useObjectDeepLink } from './lib/deepLinks.js';
import { getShareTokenFromHash } from './lib/shareRoute.js';
import { SchemaMigrationSheet } from './components/SchemaMigrationSheet.jsx';
import { ROUTE_MANIFEST, SHARE_PREVIEW_ROUTE, memoLazy } from './routes/manifest.js';

function Fallback() {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
      {t('app.loadingView')}
    </div>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">404</div>
      <h1 className="text-2xl font-bold mb-2">{t('app.notFound.title')}</h1>
      <p className="text-sm text-muted-foreground mb-5 max-w-md">
        {t('app.notFound.body')}
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        {t('app.notFound.home')}
      </Link>
    </div>
  );
}

function L({ children }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}

function DeepLinkHandler() {
  useObjectDeepLink();
  return null;
}

function SharePreviewGate({ children }) {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const token = getShareTokenFromHash(hash);
  if (!token) return children;
  const ChartPreviewLazy = memoLazy(SHARE_PREVIEW_ROUTE.loader);
  return <L><ChartPreviewLazy token={token} /></L>;
}

function renderManifestEntry(entry) {
  // Aliases redirect to a sibling/parent path with the rest of the URL preserved.
  if (entry.alias) {
    return <Route key={entry.path} path={entry.path} element={<Navigate to={entry.alias} replace />} />;
  }
  const Lazy = memoLazy(entry.loader);
  const element = Lazy ? <L><Lazy /></L> : null;
  if (entry.children) {
    return (
      <Route key={entry.path} path={entry.path} element={element}>
        {entry.indexRedirect && (
          <Route index element={<Navigate to={entry.indexRedirect} replace />} />
        )}
        {entry.children.map(renderManifestEntry)}
      </Route>
    );
  }
  return <Route key={entry.path} path={entry.path} element={element} />;
}

export function App() {
  useEffect(() => {
    // Scheduled in-app backups — settings stored in IndexedDB meta.
    // The Backup.jsx route reconfigures via its own updateSetting calls;
    // this root scheduler is the one that actually fires snapshots.
    const scheduler = startBackupScheduler();
    const onSettingsChanged = () => scheduler.reconfigure?.();
    window.addEventListener('cloudtreeweb:backup-settings-changed', onSettingsChanged);
    return () => {
      window.removeEventListener('cloudtreeweb:backup-settings-changed', onSettingsChanged);
      scheduler.stop();
    };
  }, []);
  const ChartPreviewLazy = memoLazy(SHARE_PREVIEW_ROUTE.loader);
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ThemeProvider>
      <LocalizationProvider>
       <ModalProvider>
       <DatabaseStatusProvider>
        <ActivePersonProvider>
          <DeepLinkHandler />
          <SchemaMigrationSheet />
          <SharePreviewGate>
          <Routes>
            <Route path={SHARE_PREVIEW_ROUTE.path} element={<L><ChartPreviewLazy /></L>} />
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              {ROUTE_MANIFEST.map(renderManifestEntry)}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </SharePreviewGate>
        </ActivePersonProvider>
       </DatabaseStatusProvider>
       </ModalProvider>
      </LocalizationProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
