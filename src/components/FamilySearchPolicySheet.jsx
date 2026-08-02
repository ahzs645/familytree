import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { Button } from './ui/Button.jsx';
import { Sheet } from './ui/Sheet.jsx';

const POLICY_LINKS = {
  memories: 'https://www.familysearch.org/legal/terms',
  ordinances: 'https://www.familysearch.org/legal/privacy',
};

export function FamilySearchPolicySheet({ policy, onAccept, onDecline }) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged] = useState(false);
  const checkboxRef = useRef(null);

  useEffect(() => {
    checkboxRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDecline();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDecline]);

  const prefix = `familySearch.policy.${policy}`;
  return (
    <Sheet
      title={t(`${prefix}.title`)}
      subtitle={t(`${prefix}.subtitle`)}
      ariaLabel={t(`${prefix}.title`)}
      maxWidth="max-w-xl"
      align="center"
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onDecline}>{t('familySearch.policy.decline')}</Button>
          <Button variant="primary" size="sm" disabled={!acknowledged} onClick={onAccept}>{t('familySearch.policy.accept')}</Button>
        </>
      )}
    >
      <p className="text-sm leading-relaxed">{t(`${prefix}.summary`)}</p>
      <a className="text-sm text-interactive underline" href={POLICY_LINKS[policy]} target="_blank" rel="noopener noreferrer">
        {t(`${prefix}.link`)}
      </a>
      <label className="flex items-start gap-2 rounded-md border border-border bg-secondary p-3 text-sm">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5"
        />
        <span>{t('familySearch.policy.acknowledge')}</span>
      </label>
    </Sheet>
  );
}

export default FamilySearchPolicySheet;
