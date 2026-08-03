import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { contextualActions } from '../../lib/contextualActions.js';

export function ContextualActionRail({ personId = '', familyId = '', recordType = '', recordId = '', onNavigate }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const groups = useMemo(
    () => contextualActions({ personId, familyId, recordType, recordId }),
    [familyId, personId, recordId, recordType],
  );
  const open = (href) => onNavigate ? onNavigate(href) : navigate(href);
  const content = (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.id}>
          <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`contextActions.group.${group.id}`)}</h3>
          <div className="grid gap-1">
            {group.actions.map((action) => (
              <button key={action.id} type="button" onClick={() => open(action.href)} className="rounded-md px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent">
                {t(`contextActions.action.${action.id}`)}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="order-first lg:order-2">
      <aside className="hidden h-fit rounded-lg border border-border bg-card p-3 lg:sticky lg:top-4 lg:block" aria-label={t('contextActions.title')}>
        <h2 className="mb-3 text-sm font-semibold">{t('contextActions.title')}</h2>
        {content}
      </aside>
      <details className="mb-4 rounded-lg border border-border bg-card p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold">{t('contextActions.title')}</summary>
        <div className="mt-3">{content}</div>
      </details>
    </div>
  );
}

export function DuplicateRecordAction({ recordType, recordId, onNavigate }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!recordId) return null;
  const href = contextualActions({ recordType, recordId }).flatMap((group) => group.actions).find((action) => action.id === 'duplicates')?.href;
  if (!href) return null;
  return (
    <button type="button" onClick={() => onNavigate ? onNavigate(href) : navigate(href)} className="rounded-md border border-border bg-secondary px-3 py-2 text-xs hover:bg-accent">
      {t('contextActions.action.duplicates')}
    </button>
  );
}

export default ContextualActionRail;
