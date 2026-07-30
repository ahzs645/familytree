/**
 * The screen someone sees when they open a page before any tree is loaded.
 *
 * The tree, charts and books pages each had their own copy of this, hard-coded
 * in English and assembled from three sibling nodes — "No family data found.",
 * a link, and " first." That last comma-splice construction renders in source
 * order, so in Arabic it came out back-to-front and the sentence read as
 * fragments. It is one translated string with the link inside it now, so the
 * whole line reorders as a unit under `dir`.
 *
 * It is also the first thing a reviewer sees if their shared link fails to
 * load, which makes it a bad place to be untranslated.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

export function NoDataYet({ className = '' }) {
  const { t } = useTranslation();
  const message = t('common.noFamilyDataYet', {
    defaultValue: 'No family tree loaded yet. Import a .mftpkg file to get started.',
  });
  return (
    <div className={`flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground ${className}`}>
      <p dir="auto" className="max-w-sm">
        {message}{' '}
        <Link to="/" className="text-interactive underline">
          {t('common.goToImport', { defaultValue: 'Open the import page' })}
        </Link>
      </p>
    </div>
  );
}

export default NoDataYet;
