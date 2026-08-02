import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { hasFamilySearchMockData, readFamilySearchTree } from '../lib/familySearchApi.js';
import { BdiText, LtrText } from './BdiText.jsx';
import { Button } from './ui/Button.jsx';
import { Sheet } from './ui/Sheet.jsx';
import { formClasses } from './ui/formClasses.js';

export function FamilySearchRemoteTreeSheet({ rootId, config, onImportPayloads, onClose }) {
  const { t } = useTranslation();
  const directionRef = useRef(null);
  const [direction, setDirection] = useState('ancestors');
  const [generations, setGenerations] = useState(2);
  const [tree, setTree] = useState(null);
  const [selectedId, setSelectedId] = useState(rootId);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    directionRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const load = async () => {
    if (!config?.accessToken && !hasFamilySearchMockData(config)) {
      setStatus(t('familySearch.authRequired'));
      return;
    }
    setBusy(true);
    setStatus(t('familySearch.remoteTree.loading'));
    try {
      const next = await readFamilySearchTree(config, rootId, { direction, generations });
      setTree(next);
      setSelectedId(rootId);
      setStatus(t('familySearch.remoteTree.loaded', { count: next.nodes.length }));
    } catch (error) {
      setStatus(t('familySearch.remoteTree.failed', { message: error?.message || String(error) }));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); /* root/config intentionally trigger the first bounded load */ }, [rootId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo(() => [...(tree?.nodes || [])].sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name)), [tree]);
  const selectedPayload = useMemo(() => {
    const payload = tree?.payloads?.[selectedId];
    const person = payload?.persons?.find((candidate) => candidate.id === selectedId) || payload?.person;
    return person ? { persons: [person], relationships: [] } : null;
  }, [selectedId, tree]);

  return (
    <Sheet
      title={t('familySearch.remoteTree.title')}
      subtitle={t('familySearch.remoteTree.subtitle', { id: rootId })}
      ariaLabel={t('familySearch.remoteTree.title')}
      maxWidth="max-w-3xl"
      scroll="card"
      footer={(
        <>
          <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>{t('common.close')}</Button>
          <Button variant="primary" size="sm" disabled={!selectedPayload || busy} onClick={() => onImportPayloads([selectedPayload])}>
            {t('familySearch.remoteTree.pullSelected')}
          </Button>
        </>
      )}
    >
      <div className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
        <label className="text-xs">
          <span className="block mb-1 text-muted-foreground">{t('familySearch.remoteTree.direction')}</span>
          <select ref={directionRef} value={direction} onChange={(event) => setDirection(event.target.value)} className={formClasses.input}>
            <option value="ancestors">{t('familySearch.remoteTree.ancestors')}</option>
            <option value="descendants">{t('familySearch.remoteTree.descendants')}</option>
            <option value="both">{t('familySearch.remoteTree.both')}</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block mb-1 text-muted-foreground">{t('familySearch.remoteTree.generations')}</span>
          <input type="number" min="1" max="5" value={generations} onChange={(event) => setGenerations(Math.max(1, Math.min(5, Number(event.target.value) || 1)))} className={`${formClasses.input} w-20`} />
        </label>
        <Button variant="outline" size="sm" disabled={busy} onClick={load}>{t('familySearch.remoteTree.refresh')}</Button>
      </div>
      {status && <p className="text-xs text-muted-foreground" aria-live="polite">{status}</p>}
      <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-[1fr_260px]">
        <div className="max-h-96 overflow-auto rounded-md border border-border" role="listbox" aria-label={t('familySearch.remoteTree.people')}>
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              role="option"
              aria-selected={selectedId === node.id}
              onClick={() => setSelectedId(node.id)}
              className={`block w-full border-b border-border px-3 py-2 text-start text-sm last:border-b-0 ${selectedId === node.id ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
              style={{ paddingInlineStart: `${12 + Math.min(4, node.depth || 0) * 18}px` }}
            >
              <BdiText>{node.name || node.id}</BdiText>
              <span className="block text-2xs opacity-75"><LtrText>{node.id}</LtrText></span>
            </button>
          ))}
        </div>
        <div className="rounded-md border border-border bg-secondary p-3 text-xs">
          <div className="font-semibold">{t('familySearch.remoteTree.selection')}</div>
          <div className="mt-2"><LtrText>{selectedId}</LtrText></div>
          <p className="mt-2 text-muted-foreground">{t('familySearch.remoteTree.pullHint')}</p>
        </div>
      </div>
    </Sheet>
  );
}

export default FamilySearchRemoteTreeSheet;
