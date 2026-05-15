import { useBeforeUnload } from 'react-router-dom';
import { useEffect, useMemo } from 'react';

export const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Leave this editor without saving?';

export function stableStringify(value) {
  return JSON.stringify(normalizeForStringify(value));
}

function normalizeForStringify(value) {
  if (Array.isArray(value)) return value.map(normalizeForStringify);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = normalizeForStringify(value[key]);
    return acc;
  }, {});
}

export function useDirtySnapshot(current, baseline, enabled = true) {
  return useMemo(() => {
    if (!enabled || baseline == null) return false;
    const baselineSnapshot = typeof baseline === 'string' ? baseline : stableStringify(baseline);
    return stableStringify(current) !== baselineSnapshot;
  }, [baseline, current, enabled]);
}

export function useUnsavedChanges(when, message = UNSAVED_CHANGES_MESSAGE) {
  const disabled = typeof window !== 'undefined' && window.localStorage?.getItem('cloudtreeweb:disable-unsaved-guard') === '1';
  const active = !!when && !disabled;
  useBeforeUnload((event) => {
    if (!active) return;
    event.preventDefault();
    event.returnValue = message;
  }, { capture: true });
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const onClick = (event) => {
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      const next = new URL(href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search && next.hash === window.location.hash) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, message]);
}
