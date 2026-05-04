import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_PREFERENCES_EVENT, getAppPreferences, patchAppPreferences } from '../lib/appPreferences.js';
import { applyDocumentLocalization, DEFAULT_LOCALIZATION, resolveLocalization } from '../lib/i18n.js';
import { translate } from '../lib/translate.js';

const LocalizationContext = createContext(null);

export function LocalizationProvider({ children }) {
  const [localization, setLocalization] = useState(() => resolveLocalization(DEFAULT_LOCALIZATION));

  useEffect(() => {
    let cancelled = false;
    getAppPreferences().then((prefs) => {
      if (cancelled) return;
      const next = applyDocumentLocalization(prefs.localization);
      setLocalization(next);
    });
    const onPreferences = (event) => {
      const next = applyDocumentLocalization(event.detail?.localization);
      setLocalization(next);
    };
    window.addEventListener(APP_PREFERENCES_EVENT, onPreferences);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_PREFERENCES_EVENT, onPreferences);
    };
  }, []);

  const t = useCallback((key, params = {}) => translate(key, params, { localization }), [localization]);

  const setLocale = useCallback(async (locale) => {
    const nextPrefs = await patchAppPreferences('localization.locale', locale);
    const next = applyDocumentLocalization(nextPrefs.localization);
    setLocalization(next);
  }, []);

  const value = useMemo(() => ({
    localization,
    t,
    setLocale,
  }), [localization, setLocale, t]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error('useTranslation must be used inside <LocalizationProvider>');
  return ctx;
}

export default LocalizationProvider;
