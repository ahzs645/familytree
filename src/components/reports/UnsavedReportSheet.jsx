import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/Button.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function UnsavedReportSheet({ onChoose }) {
  const { t } = useTranslation();
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onChoose('cancel');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onChoose]);
  return (
    <Sheet
      title={t('reports.dirty.title')}
      subtitle={t('reports.dirty.message')}
      ariaLabel={t('reports.dirty.title')}
      maxWidth="max-w-md"
      align="center"
      footerClassName="flex flex-wrap items-center justify-end gap-2"
      footer={(
        <>
          <Button ref={cancelRef} variant="secondary" onClick={() => onChoose('cancel')}>{t('common.cancel')}</Button>
          <Button variant="destructiveOutline" onClick={() => onChoose('discard')}>{t('reports.dirty.discard')}</Button>
          <Button variant="primary" onClick={() => onChoose('save')}>{t('reports.dirty.save')}</Button>
        </>
      )}
    >
      <p className="text-sm text-muted-foreground">{t('reports.dirty.hint')}</p>
    </Sheet>
  );
}

export default UnsavedReportSheet;
