/** FamilySearch relative download staged through the shared place reconciler. */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { getFamilySearchConfig, hasFamilySearchMockData, readFamilySearchTree } from '../lib/familySearchApi.js';
import { Button } from './ui/Button.jsx';
import { Sheet } from './ui/Sheet.jsx';
import { formClasses } from './ui/formClasses.js';

export function FamilySearchBatchDownloadSheet({ open, onClose, onImportPayloads, initialRootId = '' }) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const [rootId, setRootId] = useState(initialRootId);
  const [generations, setGenerations] = useState(2);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    if (initialRootId) setRootId(initialRootId);
    rootRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, initialRootId, onClose, open]);

  if (!open) return null;

  const run = async () => {
    if (!rootId.trim()) return;
    setBusy(true);
    setLog([t('familySearch.batch.fetching', { id: rootId.trim() })]);
    try {
      const config = await getFamilySearchConfig();
      if (!config?.accessToken && !hasFamilySearchMockData(config)) {
        setLog([t('familySearch.authRequired')]);
        return;
      }
      const tree = await readFamilySearchTree(config, rootId.trim(), { direction: 'both', generations });
      const payloads = Object.values(tree.payloads || {});
      setLog((current) => [...current, t('familySearch.batch.fetched', { count: tree.nodes.length })]);
      if (payloads.length > 0) onImportPayloads(payloads);
    } catch (error) {
      setLog((current) => [...current, t('familySearch.batch.failed', { message: error?.message || String(error) })]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t('familySearch.batch.title')}
      subtitle={t('familySearch.batch.subtitle')}
      ariaLabel={t('familySearch.batch.title')}
      maxWidth="max-w-lg"
      align="center"
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{t('common.close')}</Button>
          <Button variant="primary" size="sm" onClick={run} disabled={busy || !rootId.trim()}>
            {busy ? t('familySearch.batch.running') : t('familySearch.batch.start')}
          </Button>
        </>
      )}
    >
      <label className="block text-xs">
        <span className="block mb-1 text-muted-foreground">{t('familySearch.personId')}</span>
        <input ref={rootRef} value={rootId} onChange={(event) => setRootId(event.target.value)} placeholder={t('familySearch.personIdPlaceholder')} dir="ltr" className={formClasses.input} />
      </label>
      <label className="block text-xs">
        <span className="block mb-1 text-muted-foreground">{t('familySearch.batch.generations')}</span>
        <input type="number" min="1" max="5" value={generations} onChange={(event) => setGenerations(Math.max(1, Math.min(5, Number(event.target.value) || 1)))} className={`${formClasses.input} w-24`} />
      </label>
      <div className="max-h-48 overflow-auto rounded-md border border-border bg-secondary p-2 text-xs" aria-live="polite">
        {log.length === 0 ? <span className="text-muted-foreground">{t('familySearch.batch.ready')}</span> : log.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
      </div>
    </Sheet>
  );
}

export default FamilySearchBatchDownloadSheet;
