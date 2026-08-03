/**
 * Templates editor — manage SourceTemplate, PlaceTemplate, and the various
 * ConclusionType records (event / fact / additional name) in one place.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { TemplateKeyMigrationSheet, UsageCounts } from '../components/TemplateKeyMigrationSheet.jsx';
import {
  TEMPLATE_TABS,
  templateFieldsForType,
  templateRecordLabel,
} from '../lib/templateDefinitions.js';
import {
  loadTemplateKeyUsage,
  migrateTemplateKey,
} from '../lib/templateKeyMigration.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { deleteWithChangeLog } from '../lib/recordWrite.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

export default function Templates() {
  const [tab, setTab] = useState(TEMPLATE_TABS[0].id);
  const [pendingMigration, setPendingMigration] = useState(null);
  const modal = useModal();
  const { t } = useTranslation();
  const def = TEMPLATE_TABS.find((t) => t.id === tab);
  const isTemplateKey = tab === 'SourceTemplateKey' || tab === 'PlaceTemplateKey';

  const onSaveRecord = useCallback(async (previous, next) => {
    if (!isTemplateKey || !templateKeyNameChanged(previous, next)) {
      await saveWithChangeLog(next);
      return true;
    }
    const usage = await loadTemplateKeyUsage(previous.recordType, previous.recordName);
    if (usage.summary.total === 0) {
      await saveWithChangeLog(next, { changeKind: 'Template key rename' });
      return true;
    }
    return new Promise((resolve) => {
      setPendingMigration({ mode: 'rename', keyRecord: previous, nextRecord: next, usage, resolve });
    });
  }, [isTemplateKey]);

  const onDeleteRecord = useCallback(async (record) => {
    if (!isTemplateKey) return false;
    const usage = await loadTemplateKeyUsage(record.recordType, record.recordName);
    if (usage.summary.total === 0) {
      const confirmed = await modal.confirm(t('templatesPage.deleteUnusedConfirm'), {
        title: t('templatesPage.deleteUnusedTitle'),
        okLabel: t('simpleCrud.delete'),
        destructive: true,
      });
      if (!confirmed) return false;
      await deleteWithChangeLog(record.recordName, record.recordType);
      return true;
    }
    return new Promise((resolve) => {
      setPendingMigration({ mode: 'delete', keyRecord: record, nextRecord: null, usage, resolve });
    });
  }, [isTemplateKey, modal, t]);

  const cancelMigration = useCallback(() => {
    pendingMigration?.resolve(false);
    setPendingMigration(null);
  }, [pendingMigration]);

  const executeMigration = useCallback(async ({ strategy, targetKeyId, renamedRecord }) => {
    if (!pendingMigration) return;
    await migrateTemplateKey({
      recordType: pendingMigration.keyRecord.recordType,
      sourceKeyId: pendingMigration.keyRecord.recordName,
      strategy,
      targetKeyId,
      renamedRecord,
    });
    pendingMigration.resolve(true);
    setPendingMigration(null);
  }, [pendingMigration]);

  return (
    <div className="flex flex-col h-full">
      {/* Ten tabs wrapped onto eight rows at 390px — 63% of the screen before
          any content. They scroll as one strip instead, the same pattern the
          editor section nav and the chart option tabs use, with the edge fade
          so the overflow reads as scrollable rather than as all there is.

          The selected tab carries a transparent border rather than none:
          without it its border-box is 2px shorter than its neighbours, so the
          active tab sat lower than the rest of the row. */}
      <header className="border-b border-border bg-card px-3 py-2 md:px-5 md:py-3">
        <PageTitle className="mb-2 text-base font-semibold">{t('templatesPage.title')}</PageTitle>
        <div className="scroll-fade-inline-end -mx-3 md:-mx-5">
          <div className="no-scrollbar flex snap-x scroll-px-3 items-center gap-2 overflow-x-auto px-3 md:px-5" role="tablist">
            {TEMPLATE_TABS.map((tabDef) => (
              <button key={tabDef.id} onClick={() => setTab(tabDef.id)} role="tab" aria-selected={tab === tabDef.id}
                className={`inline-flex h-8 shrink-0 snap-start items-center rounded-md border px-3 text-xs font-medium ${tab === tabDef.id ? 'bg-primary text-primary-foreground border-transparent' : 'bg-secondary text-foreground border-border hover:bg-accent'}`}>
                {t(`templatesPage.tabs.${tabDef.id}`)}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <SimpleCrudList
          key={tab}
          recordType={def.id}
          uuidPrefix={def.uuidPrefix}
          title={t(`templatesPage.tabs.${def.id}`)}
          fields={templateFieldsForType(def.id)}
          displayLabel={templateRecordLabel}
          searchPlaceholder={t('templatesPage.search', { type: t(`templatesPage.tabs.${def.id}`) })}
          emptyText={t('templatesPage.empty', { type: t(`templatesPage.tabs.${def.id}`) })}
          onSaveRecord={isTemplateKey ? onSaveRecord : undefined}
          onDeleteRecord={isTemplateKey ? onDeleteRecord : undefined}
          renderDetailExtra={isTemplateKey ? ({ record }) => <TemplateKeyUsagePanel record={record} /> : undefined}
        />
      </div>
      {pendingMigration && (
        <TemplateKeyMigrationSheet
          mode={pendingMigration.mode}
          keyRecord={pendingMigration.keyRecord}
          nextRecord={pendingMigration.nextRecord}
          usage={pendingMigration.usage}
          onMigrate={executeMigration}
          onCancel={cancelMigration}
        />
      )}
    </div>
  );
}

function templateKeyNameChanged(previous, next) {
  return ['name', 'title', 'internationalName', 'localName', 'localizeableNameKey'].some((fieldName) => (
    String(previous.fields?.[fieldName]?.value || '') !== String(next.fields?.[fieldName]?.value || '')
  ));
}

function TemplateKeyUsagePanel({ record }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    loadTemplateKeyUsage(record.recordType, record.recordName).then((usage) => {
      if (!cancelled) setSummary(usage.summary);
    });
    return () => { cancelled = true; };
  }, [record.recordName, record.recordType, record.modified?.timestamp]);

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{t('templatesPage.usage.title')}</h3>
      {summary ? <UsageCounts summary={summary} /> : <p className="text-xs text-muted-foreground">{t('templatesPage.usage.loading')}</p>}
      <p className="text-2xs text-muted-foreground">{t('templatesPage.usage.hint')}</p>
    </section>
  );
}
