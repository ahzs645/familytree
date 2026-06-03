/**
 * /welcome — onboarding for a brand-new family tree.
 *
 * Step 1: name the tree.
 * Step 2: add yourself (first name, last name, gender, optional birth year).
 *
 * On submit: startNewTree() (which saves the previously active tree back into
 * the library first, clears the dataset, and registers the new active id),
 * then create a single Person record flagged isStartPerson and hand off to
 * /tree. Relatives are added there via the tree's existing add-relative
 * controls.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { ImportDropZone } from '../components/ImportDropZone.jsx';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { generateId } from '../lib/ids.js';
import { logRecordCreated } from '../lib/changeLog.js';
import { saveActiveTree, startNewTree, upsertActiveTreeSnapshot } from '../lib/treeLibrary.js';
import { Gender } from '../models/index.js';

function uuid(prefix) {
  return generateId(prefix);
}

const GENDER_OPTIONS = [
  { value: Gender.Male, labelKey: 'onboarding.genderMale' },
  { value: Gender.Female, labelKey: 'onboarding.genderFemale' },
  { value: Gender.UnknownGender, labelKey: 'onboarding.genderUnspecified' },
  { value: Gender.Intersex, labelKey: 'onboarding.genderIntersex' },
];

export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useDatabaseStatus();
  const modal = useModal();

  const [step, setStep] = useState(1);
  const [treeName, setTreeName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState(Gender.UnknownGender);
  const [birthYear, setBirthYear] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!treeName) setTreeName(t('onboarding.defaultTreeName', { defaultValue: 'My family tree' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext = treeName.trim().length > 0;
  const canSubmit = firstName.trim().length > 0 || lastName.trim().length > 0;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await startNewTree(treeName.trim());
      const db = getLocalDatabase();
      const first = firstName.trim();
      const last = lastName.trim();
      const fullName = `${first} ${last}`.trim();
      const fields = {
        firstName: { value: first, type: 'STRING' },
        lastName: { value: last, type: 'STRING' },
        gender: { value: gender, type: 'NUMBER' },
        cached_fullName: { value: fullName, type: 'STRING' },
        isStartPerson: { value: true, type: 'BOOLEAN' },
      };
      const year = birthYear.trim();
      if (year) fields.cached_birthDate = { value: year, type: 'STRING' };
      const record = { recordName: uuid('person'), recordType: 'Person', fields };
      await db.saveRecord(record);
      await logRecordCreated(record);
      await saveActiveTree();
      await refresh();
      modal.toast(t('onboarding.createdToast', { defaultValue: 'Family tree created.' }), { kind: 'success' });
      navigate('/tree', { replace: true });
    } catch (err) {
      console.error('[welcome] failed to create tree', err);
      await modal.alert(err?.message || t('onboarding.error', { defaultValue: 'Could not create the family tree.' }));
      setBusy(false);
    }
  };

  const onImported = async (result) => {
    await upsertActiveTreeSnapshot({ name: result?.treeName || treeName.trim() || t('onboarding.defaultTreeName', { defaultValue: 'My family tree' }) });
    await refresh();
    navigate('/tree', { replace: true });
  };

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-12 pb-16 h-full overflow-auto">
      <div className="max-w-xl mx-auto">
        <section className="mb-6">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t('onboarding.eyebrow', { defaultValue: 'Start a new family tree' })}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">
            {step === 1
              ? t('onboarding.step1Title', { defaultValue: 'Name your family tree' })
              : t('onboarding.step2Title', { defaultValue: 'Add yourself' })}
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            {step === 1
              ? t('onboarding.step1Body', { defaultValue: 'Pick a name so you can switch between trees later. You can rename it any time from “My family trees.”' })
              : t('onboarding.step2Body', { defaultValue: 'You become the starting person of this tree. After this step you can add parents, a partner, and children directly in the tree view.' })}
          </p>
        </section>

        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t('import.title', { defaultValue: 'Import family tree' })}
          </div>
          <h2 className="text-lg font-semibold mb-2">Open an existing tree</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Import a MacFamilyTree package, GEDCOM file, or backup instead of starting from scratch.
          </p>
          <ImportDropZone onImported={onImported} />
        </section>

        <ol className="flex items-center gap-2 mb-6 text-xs text-muted-foreground" aria-label={t('onboarding.stepsAria', { defaultValue: 'Onboarding steps' })}>
          <li className={step === 1 ? 'font-semibold text-foreground' : ''}>1. {t('onboarding.step1Label', { defaultValue: 'Tree name' })}</li>
          <li aria-hidden>·</li>
          <li className={step === 2 ? 'font-semibold text-foreground' : ''}>2. {t('onboarding.step2Label', { defaultValue: 'About you' })}</li>
        </ol>

        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 sm:p-6">
          {step === 1 && (
            <div className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">
                  {t('onboarding.treeNameLabel', { defaultValue: 'Family tree name' })}
                </span>
                <input
                  type="text"
                  value={treeName}
                  onChange={(e) => setTreeName(e.target.value)}
                  placeholder={t('onboarding.treeNamePlaceholder', { defaultValue: 'e.g. The Smith family' })}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  required
                />
              </label>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm hover:bg-accent"
                >
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setStep(2)}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
                >
                  {t('onboarding.next', { defaultValue: 'Next' })}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium mb-1.5">
                    {t('onboarding.firstNameLabel', { defaultValue: 'First name' })}
                  </span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium mb-1.5">
                    {t('onboarding.lastNameLabel', { defaultValue: 'Last name' })}
                  </span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium mb-1.5">
                    {t('onboarding.genderLabel', { defaultValue: 'Gender' })}
                  </span>
                  <select
                    value={gender}
                    onChange={(e) => setGender(Number(e.target.value))}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {GENDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey, { defaultValue: opt.labelKey })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium mb-1.5">
                    {t('onboarding.birthYearLabel', { defaultValue: 'Birth year (optional)' })}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder={t('onboarding.birthYearPlaceholder', { defaultValue: 'e.g. 1990' })}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('onboarding.relativesHint', { defaultValue: 'After this, you can add parents, a partner, and children using the buttons in the tree view.' })}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={busy}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  {t('onboarding.back', { defaultValue: 'Back' })}
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || busy}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
                >
                  {busy
                    ? t('onboarding.creating', { defaultValue: 'Creating…' })
                    : t('onboarding.create', { defaultValue: 'Create family tree' })}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
