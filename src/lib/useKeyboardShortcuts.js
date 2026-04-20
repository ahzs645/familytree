import { useEffect } from 'react';

/**
 * useKeyboardShortcuts — register a map of `key → handler` that fires when
 * no input/textarea/contenteditable element has focus. Keys use the form
 * `ctrl+k`, `shift+/`, `g p` (sequence, 800ms timeout), or a bare `b`.
 *
 * The hook is idempotent and cleans up on unmount.
 */
export function useKeyboardShortcuts(bindings) {
  useEffect(() => {
    if (!bindings) return undefined;
    const sequenceState = { keys: [], timer: null };

    const fireSequence = (event) => {
      if (sequenceState.keys.length === 0) return;
      const combo = sequenceState.keys.join(' ');
      const handler = bindings[combo];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
      sequenceState.keys = [];
    };

    const onKey = (event) => {
      const target = event.target;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (event.metaKey || event.ctrlKey) {
        const combo = buildCombo(event);
        const handler = bindings[combo];
        if (handler) {
          event.preventDefault();
          handler(event);
        }
        return;
      }
      if (event.altKey) return;
      const key = event.key?.length === 1 ? event.key.toLowerCase() : event.key;
      sequenceState.keys.push(key);
      if (sequenceState.timer) clearTimeout(sequenceState.timer);
      // First try immediate match for single-letter bindings.
      const immediateCombo = sequenceState.keys.join(' ');
      if (bindings[immediateCombo] && sequenceState.keys.length === 1 && !hasSequencePrefix(bindings, immediateCombo)) {
        event.preventDefault();
        bindings[immediateCombo](event);
        sequenceState.keys = [];
        return;
      }
      sequenceState.timer = setTimeout(() => fireSequence(event), 800);
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (sequenceState.timer) clearTimeout(sequenceState.timer);
    };
  }, [bindings]);
}

function buildCombo(event) {
  const parts = [];
  if (event.metaKey || event.ctrlKey) parts.push('ctrl');
  if (event.shiftKey && event.key?.length === 1) parts.push('shift');
  const key = event.key?.length === 1 ? event.key.toLowerCase() : event.key?.toLowerCase();
  parts.push(key);
  return parts.join('+');
}

function hasSequencePrefix(bindings, prefix) {
  const needle = `${prefix} `;
  return Object.keys(bindings).some((k) => k.startsWith(needle));
}
