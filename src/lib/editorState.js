import { useBeforeUnload, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useModal } from '../contexts/ModalContext.jsx';

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

/**
 * Unsaved-changes tracking for record editors.
 *
 * Captures the dirty baseline only once a load has *settled* — the editor's
 * `reload()` bumps a counter (`reloadKey`) on its last line, so async
 * sub-record hydration (facts, children, labels…) is never mistaken for a user
 * edit. Without this, editors open already reading "dirty" and the navigation
 * guard misfires. Also re-captures whenever the edited record changes
 * (`recordKey`), and wires up the leave-without-saving guard.
 *
 * Returns the current `dirty` boolean.
 *
 *   const [loadSeq, setLoadSeq] = useState(0);
 *   const reload = useCallback(async () => { …; setLoadSeq((n) => n + 1); }, [...]);
 *   const dirty = useDirtyBaseline(snapshot, {
 *     recordKey: active?.recordName, reloadKey: loadSeq, enabled: !!active && !saving,
 *   });
 */
export function useDirtyBaseline(snapshot, { recordKey = null, reloadKey = 0, enabled = true } = {}) {
  const [baseline, setBaseline] = useState(null);
  const snapshotRef = useRef(null);
  snapshotRef.current = snapshot;

  useEffect(() => {
    if (recordKey == null) return undefined;
    // A freshly loaded/reloaded record hydrates its sub-records across several
    // async ticks (facts, children, labels, coordinates…). Fold those into the
    // baseline during a short "settle" window so they aren't mistaken for
    // edits — but end the window the instant the user interacts, so a real
    // edit is captured as dirty rather than absorbed. (recordKey re-arms on
    // record switch; reloadKey re-arms after save/lock when the key is stable.)
    let stopped = false;
    const timers = [];
    const capture = () => { if (!stopped) setBaseline(stableStringify(snapshotRef.current)); };
    function endSettle() {
      if (stopped) return;
      stopped = true;
      capture();
      timers.forEach(clearTimeout);
      document.removeEventListener('pointerdown', endSettle, true);
      document.removeEventListener('keydown', endSettle, true);
    }
    capture();
    timers.push(
      setTimeout(capture, 60),
      setTimeout(capture, 250),
      setTimeout(capture, 600),
      setTimeout(endSettle, 900),
    );
    document.addEventListener('pointerdown', endSettle, true);
    document.addEventListener('keydown', endSettle, true);
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      document.removeEventListener('pointerdown', endSettle, true);
      document.removeEventListener('keydown', endSettle, true);
    };
  }, [recordKey, reloadKey]);

  const dirty = useDirtySnapshot(snapshot, baseline, enabled);
  useUnsavedChanges(dirty);
  return dirty;
}

export function useUnsavedChanges(when, message = UNSAVED_CHANGES_MESSAGE) {
  const modal = useModal();
  const navigate = useNavigate();
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
      event.preventDefault();
      event.stopPropagation();
      modal.confirm(message, {
        title: 'Unsaved changes',
        okLabel: 'Leave editor',
        destructive: true,
      }).then((confirmed) => {
        if (!confirmed) return;
        navigate(`${next.pathname}${next.search}${next.hash}`);
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, message, modal, navigate]);
}

export async function confirmUnsavedChanges(when, modal, message = UNSAVED_CHANGES_MESSAGE) {
  if (!when) return true;
  if (typeof window === 'undefined') return true;
  if (window.localStorage?.getItem('cloudtreeweb:disable-unsaved-guard') === '1') return true;
  return modal.confirm(message, {
    title: 'Unsaved changes',
    okLabel: 'Leave editor',
    destructive: true,
  });
}
