import { useEffect, useRef } from 'react';

/**
 * Save the current editor with ⌘/Ctrl+S.
 *
 * Uses the capture phase so it wins over the global AppShell shortcut (which
 * otherwise downloads a backup on Ctrl+S), and works even when focus is inside
 * a form field. No-op while `enabled` is false (e.g. saving, locked, or clean).
 */
export function useSaveShortcut(onSave, { enabled = true } = {}) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event) => {
      if (event.key?.toLowerCase() !== 's') return;
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      onSaveRef.current?.();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
