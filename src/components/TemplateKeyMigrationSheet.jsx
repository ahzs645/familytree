import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { TEMPLATE_KEY_MIGRATION_STRATEGIES } from '../lib/templateKeyMigration.js';
import { templateRecordLabel } from '../lib/templateDefinitions.js';
import { Button } from './ui/Button.jsx';
import { Sheet } from './ui/Sheet.jsx';

export function TemplateKeyMigrationSheet({ mode, keyRecord, nextRecord, usage, onMigrate, onCancel }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [strategy, setStrategy] = useState(mode === 'rename' ? TEMPLATE_KEY_MIGRATION_STRATEGIES.PRESERVE : TEMPLATE_KEY_MIGRATION_STRATEGIES.MAP);
  const [targetKeyId, setTargetKeyId] = useState(usage.keys[0]?.recordName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    dialogRef.current?.querySelector('input, select, button')?.focus();
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || saving) return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onCancel, saving]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onMigrate({ strategy, targetKeyId, renamedRecord: nextRecord });
    } catch {
      setError(t('templatesPage.migration.failed'));
      setSaving(false);
    }
  };

  return (
    <Sheet
      dialogRef={dialogRef}
      ariaLabel={t('templatesPage.migration.ariaLabel')}
      title={mode === 'rename' ? t('templatesPage.migration.renameTitle') : t('templatesPage.migration.deleteTitle')}
      subtitle={t('templatesPage.migration.subtitle', { name: templateRecordLabel(keyRecord) })}
      maxWidth="max-w-xl"
      scroll="body"
      footer={(
        <>
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
            {t('templatesPage.migration.cancel')}
          </button>
          <Button
            variant={strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.ABANDON ? 'destructive' : 'primary'}
            size="sm"
            disabled={saving || (strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.MAP && !targetKeyId)}
            onClick={submit}
          >
            {saving ? t('templatesPage.migration.migrating') : t('templatesPage.migration.continue')}
          </Button>
        </>
      )}
    >
      <UsageCounts summary={usage.summary} />
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t('templatesPage.migration.chooseAction')}</legend>
        {mode === 'rename' && (
          <MigrationOption
            checked={strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.PRESERVE}
            onChange={() => setStrategy(TEMPLATE_KEY_MIGRATION_STRATEGIES.PRESERVE)}
            title={t('templatesPage.migration.preserveTitle')}
            description={t('templatesPage.migration.preserveDescription')}
          />
        )}
        <MigrationOption
          checked={strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.MAP}
          onChange={() => setStrategy(TEMPLATE_KEY_MIGRATION_STRATEGIES.MAP)}
          title={t('templatesPage.migration.mapTitle')}
          description={t('templatesPage.migration.mapDescription')}
        />
        {strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.MAP && (
          <label className="block ps-7">
            <span className="mb-1 block text-xs text-muted-foreground">{t('templatesPage.migration.targetKey')}</span>
            <select value={targetKeyId} onChange={(event) => setTargetKeyId(event.target.value)} className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm">
              <option value="">{t('templatesPage.migration.chooseTarget')}</option>
              {usage.keys.map((record) => <option key={record.recordName} value={record.recordName}>{templateRecordLabel(record)}</option>)}
            </select>
            <span className="mt-1 block text-2xs text-muted-foreground">{t('templatesPage.migration.collisionHint')}</span>
          </label>
        )}
        <MigrationOption
          checked={strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.ABANDON}
          onChange={() => setStrategy(TEMPLATE_KEY_MIGRATION_STRATEGIES.ABANDON)}
          title={t('templatesPage.migration.abandonTitle')}
          description={t('templatesPage.migration.abandonDescription')}
          destructive
        />
      </fieldset>
      {error && <p className="text-sm text-destructive-text" role="alert">{error}</p>}
    </Sheet>
  );
}

export function UsageCounts({ summary }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-4">
      <UsageCount value={summary.recordCount} label={t('templatesPage.usage.records')} />
      <UsageCount value={summary.valueCount} label={t('templatesPage.usage.values')} />
      <UsageCount value={summary.templateCount} label={t('templatesPage.usage.templates')} />
      <UsageCount value={summary.relationCount} label={t('templatesPage.usage.relations')} />
    </div>
  );
}

function UsageCount({ value, label }) {
  return (
    <div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-2xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MigrationOption({ checked, onChange, title, description, destructive = false }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${checked ? destructive ? 'border-destructive bg-destructive/10' : 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
      <input type="radio" name="template-key-migration" checked={checked} onChange={onChange} className="mt-1" />
      <span>
        <span className={`block text-sm font-semibold ${destructive ? 'text-destructive-text' : ''}`}>{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export default TemplateKeyMigrationSheet;
