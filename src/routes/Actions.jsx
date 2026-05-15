import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { importContactsFile } from '../lib/contactImport.js';
import { clearBackupHistory } from '../lib/backup.js';
import { clearTreeSnapshots } from '../lib/treeLibrary.js';

const btn = 'bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60';
const btnSecondary = 'bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm hover:bg-accent disabled:opacity-60';

const HELP_LINKS = {
  manual: 'https://www.macfamilytree.com/manuals/',
  tutorials: 'https://www.macfamilytree.com/videos/',
  faq: 'https://www.macfamilytree.com/faq/',
  feedback: 'https://www.macfamilytree.com/contact/',
  website: 'https://www.macfamilytree.com/',
  updates: 'https://www.macfamilytree.com/updates/',
  buyNow: 'https://www.macfamilytree.com/store/',
};

function ActionCard({ title, description, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  );
}

function openExternal(url) {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    /* no-op */
  }
}

function parseCloudShareInput(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const directToken = text.match(/^([A-Za-z0-9._-]{16,})$/);
  if (directToken) return directToken[1];

  const hashMatch = text.match(/#\/view\/([^#/?]+)/);
  if (hashMatch?.[1]) return hashMatch[1];

  const pathMatch = text.match(/\/view\/([^#/?]+)/);
  if (pathMatch?.[1]) return pathMatch[1];

  return null;
}

export default function Actions() {
  const { t } = useTranslation();
  const modal = useModal();
  const navigate = useNavigate();
  const { refresh, clear } = useDatabaseStatus();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const contactsRef = useRef(null);

  const withBusy = async (label, task) => {
    setBusy(true);
    setStatus(label);
    try {
      const result = await task();
      if (result) setStatus(result);
      return result;
    } catch (error) {
      setStatus(`${t('actions.operationFailed')}: ${error.message}`);
      await modal.alert(`${t('actions.operationFailed')}: ${error.message}`);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const onNewDocument = async () => {
    const confirmed = await modal.confirm(t('actions.newDocumentConfirm'), {
      title: t('actions.newDocument'),
      okLabel: t('actions.newDocumentButton'),
      destructive: true,
    });
    if (!confirmed) return;
    await withBusy(t('actions.newDocumentWorking'), async () => {
      await clear();
      await refresh();
      navigate('/');
      modal.toast(t('actions.newDocumentDone'), { kind: 'success' });
      return t('actions.newDocumentDone');
    });
  };

  const onHardReset = async () => {
    const confirmed = await modal.confirm(t('actions.hardResetConfirm'), {
      title: t('actions.hardReset'),
      okLabel: t('actions.hardResetButton'),
      destructive: true,
    });
    if (!confirmed) return;
    await withBusy(t('actions.hardResetWorking'), async () => {
      await clear();
      await Promise.all([clearTreeSnapshots(), clearBackupHistory()]);
      await refresh();
      navigate('/');
      modal.toast(t('actions.hardResetDone'), { kind: 'success' });
      return t('actions.hardResetDone');
    });
  };

  const onImportContacts = async (file) => {
    if (!file) return;
    await withBusy(t('actions.importContactsWorking'), async () => {
      const result = await importContactsFile(file);
      await refresh();
      if (contactsRef.current) contactsRef.current.value = '';
      return t('actions.importContactsDone', { count: result.created });
    });
    if (contactsRef.current) contactsRef.current.value = '';
  };

  const onAcceptCloudKitShare = async () => {
    const raw = window.prompt(t('actions.acceptCloudSharePrompt'));
    if (!raw) return;
    const token = parseCloudShareInput(raw);
    if (token) {
      navigate(`/view/${encodeURIComponent(token)}`);
      return;
    }
    onInvalidCloudShare();
  };

  const onInvalidCloudShare = () => {
    modal.alert(
      t('actions.acceptCloudShareInvalid', {
        defaultValue: 'Enter a valid share link or token.',
      }),
      { title: t('actions.acceptCloudShareTitle', { defaultValue: 'Open cloud share' }) },
    );
  };

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 pb-16 h-full overflow-auto">
      <section className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">{t('actions.title')}</h1>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          {t('actions.subtitle')}
        </p>
      </section>

      <section className="mb-6 grid gap-5">
        <ActionCard title={t('actions.workflowTitle')} description={t('actions.workflowDescription')}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/welcome')} className={btnSecondary}>
              {t('actions.openWelcome')}
            </button>
            <button
              type="button"
              onClick={onNewDocument}
              disabled={busy}
              className={btn}
            >
              {t('actions.newDocument')}
            </button>
            <button
              type="button"
              onClick={onHardReset}
              disabled={busy}
              className={btnSecondary}
            >
              {t('actions.hardReset')}
            </button>
          </div>
        </ActionCard>

        <ActionCard title={t('actions.importTitle')} description={t('actions.importDescription')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-wrap gap-2">
              <input
                ref={contactsRef}
                type="file"
                accept=".csv,text/csv,.vcf,.vcard,text/vcard,text/x-vcard"
                className="hidden"
                onChange={(event) => onImportContacts(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => contactsRef.current?.click()}
                disabled={busy}
                className={btnSecondary}
              >
                {t('actions.importContacts')}
              </button>
              <Link to="/export?focus=contacts-import" className={btnSecondary}>
                {t('actions.openAddressBookImport')}
              </Link>
              <Link to="/export?focus=gedcom-import" className={btnSecondary}>
                {t('actions.openImportGedcom')}
              </Link>
              <Link to="/export?focus=merge-tree" className={btnSecondary}>
                {t('actions.openMergeDatabases')}
              </Link>
              <Link to="/export?focus=gedcom-export" className={btnSecondary}>
                {t('actions.openExportGedcom')}
              </Link>
              <Link to="/export?focus=full-backup" className={btnSecondary}>
                {t('actions.openExportFamilyTree')}
              </Link>
              <Link to="/backup" className={btnSecondary}>
                {t('actions.openBackup')}
              </Link>
              <Link to="/backup?focus=create-backup" className={btnSecondary}>
                {t('actions.openCreateBackupNow')}
              </Link>
              <Link to="/backup?focus=restore-backup" className={btnSecondary}>
                {t('actions.openRestoreBackups')}
              </Link>
              <Link to="/backup?focus=backup-settings" className={btnSecondary}>
                {t('actions.openBackupSettings')}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/export?focus=subtree-actions" className={btnSecondary}>
                {t('actions.openSubtree')}
              </Link>
              <Link to="/search" className={btnSecondary}>
                {t('actions.openSearch')}
              </Link>
              <Link to="/search-and-replace" className={btnSecondary}>
                {t('actions.openSearchAndReplace')}
              </Link>
              <Link to="/duplicates" className={btnSecondary}>
                {t('actions.openDuplicateEntries')}
              </Link>
              <Link to="/duplicates?kind=Place" className={btnSecondary}>
                {t('actions.openDuplicatePlaces')}
              </Link>
              <Link to="/export?focus=subtree-actions" className={btnSecondary}>
                {t('actions.openSubtreeActions')}
              </Link>
              <button type="button" onClick={onAcceptCloudKitShare} className={btnSecondary}>
                {t('actions.openAcceptCloudKitShare')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/repositories" className={btnSecondary}>
                {t('actions.openSourceRepositories')}
              </Link>
            </div>
          </div>
        </ActionCard>

        <ActionCard title={t('actions.settingsTitle')} description={t('actions.settingsDescription')}>
          <div className="flex flex-wrap gap-2">
            <Link to="/labels" className={btnSecondary}>
              {t('actions.openLabels')}
            </Link>
            <Link to="/repositories" className={btnSecondary}>
              {t('actions.openRepositories')}
            </Link>
              <Link to="/places?focus=missing-coordinates" className={btnSecondary}>
                {t('actions.openMissingCoordinates')}
              </Link>
            <Link to="/slideshow" className={btnSecondary}>
              {t('actions.openSlideshow')}
            </Link>
          </div>
        </ActionCard>

        <ActionCard title={t('actions.helpTitle')} description={t('actions.helpDescription')}>
          <div className="flex flex-wrap gap-2">
            <Link to="/about" className={btnSecondary}>
              {t('actions.openAbout', { defaultValue: 'About MacFamilyTree' })}
            </Link>
            <button type="button" onClick={() => openExternal(HELP_LINKS.manual)} className={btnSecondary}>
              {t('actions.openManual')}
            </button>
            <button type="button" onClick={() => openExternal(HELP_LINKS.tutorials)} className={btnSecondary}>
              {t('actions.openVideoTutorials')}
            </button>
            <button type="button" onClick={() => openExternal(HELP_LINKS.faq)} className={btnSecondary}>
              {t('actions.openFaq')}
            </button>
            <button type="button" onClick={() => openExternal(HELP_LINKS.feedback)} className={btnSecondary}>
              {t('actions.sendFeedback')}
            </button>
            <button type="button" onClick={() => openExternal(HELP_LINKS.website)} className={btnSecondary}>
              {t('actions.visitWebsite')}
            </button>
            <button type="button" onClick={() => openExternal(HELP_LINKS.updates)} className={btnSecondary}>
              {t('actions.checkForUpdates')}
            </button>
            <button type="button" onClick={() => openExternal(HELP_LINKS.buyNow)} className={btnSecondary}>
              {t('actions.buyNow')}
            </button>
          </div>
        </ActionCard>
      </section>

      {status && (
        <p className="text-xs text-muted-foreground border border-border rounded-md px-3 py-2 bg-card max-w-3xl">
          {status}
        </p>
      )}
    </div>
  );
}
