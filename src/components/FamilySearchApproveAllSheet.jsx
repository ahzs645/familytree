import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { Button } from './ui/Button.jsx';
import { Sheet } from './ui/Sheet.jsx';

export function FamilySearchApproveAllSheet({ tasks, onApprove, onClose }) {
  const { t } = useTranslation();
  const confirmRef = useRef(null);
  const [queue] = useState(() => [...tasks]);
  const [phase, setPhase] = useState('confirm');
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && phase !== 'running') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, phase]);

  const run = async () => {
    setPhase('running');
    const results = [];
    for (const task of queue) {
      setProgress([...results, { id: task.id, name: task.personName, status: 'running' }]);
      try {
        await onApprove(task);
        results.push({ id: task.id, name: task.personName, status: 'approved' });
      } catch (error) {
        results.push({ id: task.id, name: task.personName, status: 'failed', error: error?.message || String(error) });
      }
      setProgress([...results]);
    }
    setPhase('summary');
  };

  const approved = progress.filter((item) => item.status === 'approved').length;
  const failed = progress.filter((item) => item.status === 'failed').length;
  return (
    <Sheet
      title={t('familySearch.autoMatches.approveAllTitle')}
      subtitle={phase === 'confirm'
        ? t('familySearch.autoMatches.confirmCount', { count: queue.length })
        : phase === 'running'
          ? t('familySearch.autoMatches.progress', { complete: approved + failed, count: queue.length })
          : t('familySearch.autoMatches.summary', { approved, failed })}
      ariaLabel={t('familySearch.autoMatches.approveAllTitle')}
      maxWidth="max-w-lg"
      align="center"
      footer={phase === 'confirm' ? (
        <>
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button ref={confirmRef} variant="primary" size="sm" onClick={run}>{t('familySearch.autoMatches.approveAll')}</Button>
        </>
      ) : phase === 'summary' ? <Button variant="primary" size="sm" onClick={onClose}>{t('common.close')}</Button> : null}
    >
      {phase === 'confirm' ? (
        <p className="text-sm text-muted-foreground">{t('familySearch.autoMatches.confirmHint')}</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-auto" aria-live="polite">
          {progress.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary px-3 py-2 text-xs">
              <bdi className="truncate">{item.name}</bdi>
              <span className={item.status === 'failed' ? 'text-destructive-text' : item.status === 'approved' ? 'text-success-text' : 'text-muted-foreground'}>
                {t(`familySearch.autoMatches.status.${item.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export default FamilySearchApproveAllSheet;
