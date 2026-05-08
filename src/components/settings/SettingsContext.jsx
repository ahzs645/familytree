/**
 * Provider that owns every piece of state shared across the Settings panels.
 *
 * The Settings layout (routes/Settings.jsx) wraps its <Outlet /> in this
 * provider so panels can read and update preferences without explicit
 * prop-drilling. `update(section, key, value)` merges a key into a nested
 * preferences object; `updateMap(key, value)` does the same for the
 * geocoding map preferences (which live in their own store).
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import {
  getAppPreferences,
  preferenceDownloadPayload,
  resetAppPreferences,
  saveAppPreferences,
} from '../../lib/appPreferences.js';
import { getMapPreferences, saveMapPreferences } from '../../lib/placeGeocoding.js';

const SettingsContext = createContext(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

export function SettingsProvider({ children }) {
  const modal = useModal();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState(null);
  const [mapPrefs, setMapPrefs] = useState(null);
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [app, map] = await Promise.all([getAppPreferences(), getMapPreferences()]);
      if (!cancelled) {
        setPrefs(app);
        setMapPrefs(map);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((section, key, value) => {
    setPrefs((current) => ({
      ...current,
      [section]: {
        ...(current?.[section] || {}),
        [key]: value,
      },
    }));
  }, []);

  const updateMap = useCallback((key, value) => {
    setMapPrefs((current) => ({ ...(current || {}), [key]: value }));
  }, []);

  const save = useCallback(async () => {
    const [nextPrefs, nextMap] = await Promise.all([
      saveAppPreferences(prefs),
      mapPrefs ? saveMapPreferences(mapPrefs) : Promise.resolve(mapPrefs),
    ]);
    setPrefs(nextPrefs);
    setMapPrefs(nextMap);
    setStatus(t('settingsPage.saved'));
    setTimeout(() => setStatus(''), 1500);
  }, [mapPrefs, prefs, t]);

  const reset = useCallback(async () => {
    if (!(await modal.confirm(t('settingsPage.resetConfirm'), { title: t('settingsPage.resetTitle'), okLabel: t('settingsPage.resetOk'), destructive: true }))) return;
    const next = await resetAppPreferences();
    setPrefs(next);
    setStatus(t('settingsPage.resetStatus'));
    setTimeout(() => setStatus(''), 1500);
  }, [modal, t]);

  const exportPrefs = useCallback(() => {
    const blob = new Blob([JSON.stringify(preferenceDownloadPayload(prefs), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudtreeweb-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [prefs]);

  const importPrefs = useCallback(async (file) => {
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    const next = await saveAppPreferences(parsed.preferences || parsed);
    setPrefs(next);
    setStatus(t('settingsPage.imported'));
    setTimeout(() => setStatus(''), 1500);
  }, [t]);

  const value = {
    prefs,
    setPrefs,
    mapPrefs,
    update,
    updateMap,
    theme,
    setTheme,
    save,
    reset,
    exportPrefs,
    importPrefs,
    status,
    fileRef,
    t,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
