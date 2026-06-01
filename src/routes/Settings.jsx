/**
 * Settings layout — header + tab nav + nested route outlet.
 *
 * Each tab is a real route (/settings/general, /settings/privacy, ...) with
 * its own lazy-loaded panel, so opening the page only ships the panel the
 * user is looking at. The shared Save / Reset / status row sits in this
 * layout, and the SettingsProvider exposes the preference state to whichever
 * panel renders into the outlet.
 */
import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SettingsProvider, useSettings } from '../components/settings/SettingsContext.jsx';
import { primaryButton, secondaryButton } from '../components/settings/sharedUI.jsx';

const TAB_IDS = [
  'general', 'formats', 'arabic-islamic', 'tree-layout', 'maps', 'media',
  'pdf', 'history', 'content-download', 'edit-controllers', 'categories',
  'export', 'privacy', 'plausibility', 'integrations', 'functions',
];

function SettingsLayout() {
  const { prefs, mapPrefs, save, reset, status, t } = useSettings();
  const tabs = TAB_IDS.map((id) => ({ id, label: t(`settingsPage.tabs.${id}`) }));
  const location = useLocation();
  const navigate = useNavigate();

  // /settings (no panel) → redirect to first tab. We do it in JSX so the
  // SettingsProvider has already finished loading prefs when we arrive.
  React.useEffect(() => {
    if (location.pathname.replace(/\/$/, '').endsWith('/settings')) {
      navigate('general', { replace: true });
    }
  }, [location.pathname, navigate]);

  if (!prefs || !mapPrefs) return <div className="p-10 text-muted-foreground">{t('settingsPage.loading')}</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="flex flex-wrap items-center gap-3 mb-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{t('settingsPage.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('settingsPage.subtitle')}</p>
          </div>
          {status && <span className="text-xs text-emerald-500">{status}</span>}
          <div className="ms-auto flex flex-wrap items-center gap-3">
            <button onClick={save} className={primaryButton}>{t('settingsPage.save')}</button>
            <button onClick={reset} className={secondaryButton}>{t('settingsPage.reset')}</button>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto whitespace-nowrap border-b border-border mb-5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.id}
              className={({ isActive }) =>
                `shrink-0 px-3 py-2.5 text-sm font-semibold border-b-2 ${isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <SettingsProvider>
      <SettingsLayout />
    </SettingsProvider>
  );
}
