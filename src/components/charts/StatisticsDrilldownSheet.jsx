import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { Button } from '../ui/Button.jsx';
import { Sheet } from '../ui/Sheet.jsx';

export function StatisticsDrilldownSheet({ value, onClose }) {
  const { t } = useTranslation();
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <Sheet title={value.title} subtitle={t('statistics.drilldownCount', { count: value.rows.length })} ariaLabel={t('statistics.drilldownTitle')} scroll="card" footer={<Button ref={closeRef} variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      {value.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('statistics.noMatchingRecords')}</p> : (
        <ul className="divide-y divide-border">
          {value.rows.map((row) => (
            <li key={`${row.recordType}-${row.id}`}>
              <Link to={recordHref(row)} className="block px-2 py-2 text-sm text-interactive hover:bg-accent hover:underline">{row.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function recordHref(row) {
  if (row.recordType === 'Person') return `/person/${encodeURIComponent(row.id)}`;
  if (row.recordType === 'Family') return `/family/${encodeURIComponent(row.id)}`;
  return `/places?placeId=${encodeURIComponent(row.id)}`;
}

export default StatisticsDrilldownSheet;
