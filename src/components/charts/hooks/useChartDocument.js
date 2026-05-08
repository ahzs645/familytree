/**
 * State for the active "chart document" — the persisted snapshot that the
 * Saved Charts list manages. Tracks which document is currently loaded,
 * its display name, whether the user has unsaved changes (`isDirty`), and
 * whether the document is read-only.
 *
 * The dirty-tracking sweep itself lives in ChartsApp, which knows the full
 * list of persisted state values; this hook just owns the booleans plus a
 * ref that load/save handlers can use to suppress the next sweep.
 */
import { useRef, useState } from 'react';

export function useChartDocument() {
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [currentDocumentName, setCurrentDocumentName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const dirtyGuardRef = useRef(false);

  return {
    currentDocumentId,
    setCurrentDocumentId,
    currentDocumentName,
    setCurrentDocumentName,
    isDirty,
    setIsDirty,
    isReadOnly,
    setIsReadOnly,
    dirtyGuardRef,
  };
}
