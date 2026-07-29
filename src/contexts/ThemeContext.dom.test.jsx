// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext.jsx';

let systemDark;
let mediaListeners;

beforeEach(() => {
  systemDark = true;
  mediaListeners = new Set();
  const values = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    },
  });
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: systemDark,
      addEventListener: (_name, listener) => mediaListeners.add(listener),
      removeEventListener: (_name, listener) => mediaListeners.delete(listener),
    })),
  });
});

afterEach(cleanup);

describe('ThemeProvider', () => {
  it('resolves and follows the OS while preserving the system preference', () => {
    localStorage.setItem('cloudtreeweb:theme', 'system');
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    expect(screen.getByTestId('theme').textContent).toBe('dark/system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#0e1016');

    systemDark = false;
    act(() => {
      mediaListeners.forEach((listener) => listener({ matches: systemDark }));
    });

    expect(screen.getByTestId('theme').textContent).toBe('light/system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#ffffff');
  });

  it('keeps explicit themes stable when the OS changes', () => {
    localStorage.setItem('cloudtreeweb:theme', 'light');
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('light/light');

    act(() => {
      mediaListeners.forEach((listener) => listener({ matches: false }));
    });

    expect(screen.getByTestId('theme').textContent).toBe('light/light');
    expect(localStorage.getItem('cloudtreeweb:theme')).toBe('light');
  });
});

function ThemeProbe() {
  const { theme, themePreference } = useTheme();
  return <div data-testid="theme">{theme}/{themePreference}</div>;
}
