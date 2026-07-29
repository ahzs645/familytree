/**
 * Light/dark/system theme provider.
 *
 * `theme` remains the resolved light/dark value for existing map, chart, and
 * navigation consumers. `themePreference` exposes the persisted user choice so
 * settings can represent "System" without making every consumer understand it.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'cloudtreeweb:theme';
const ThemeContext = createContext(null);
const THEME_COLORS = {
  light: '#ffffff',
  dark: '#0e1016',
};

function normalizeThemePreference(value) {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function readInitialThemePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeThemePreference(saved);
  } catch {
    return 'system';
  }
}

function readSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreference] = useState(readInitialThemePreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    setSystemTheme(media.matches ? 'dark' : 'light');
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener?.(onChange);
    return () => media.removeListener?.(onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', THEME_COLORS[resolvedTheme]);
    try {
      localStorage.setItem(STORAGE_KEY, themePreference);
    } catch {
      /* ignore */
    }
  }, [resolvedTheme, themePreference]);

  const setTheme = useCallback((next) => {
    setThemePreference((current) => normalizeThemePreference(
      typeof next === 'function' ? next(current) : next
    ));
  }, []);
  const toggle = useCallback(() => {
    setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme]);

  const value = useMemo(() => ({
    theme: resolvedTheme,
    resolvedTheme,
    themePreference,
    toggle,
    setTheme,
  }), [resolvedTheme, setTheme, themePreference, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
