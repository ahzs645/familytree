/**
 * Canvas key. Chrome, so it uses the app's card surface and type scale; the
 * line swatches read the same variables the connectors are drawn with, so the
 * key always matches whichever canvas theme is active.
 */
import React from 'react';
import { originLabel } from './constants.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export default function Legend({ nodes }) {
  const { t } = useTranslation();

  // Find all unique origins present in the current dataset
  const presentOrigins = new Set();
  nodes?.forEach((node) => {
    if (node.origin === 'dual') {
      presentOrigins.add('polish'); // 'dual' identity uses the Polish flag design
    } else if (node.origin) {
      presentOrigins.add(node.origin);
    }
  });

  const uniqueOrigins = Array.from(presentOrigins).sort();

  return (
    <div className="legend absolute bottom-4 end-4 z-30 max-w-[calc(100%-2rem)] rounded-lg border border-border bg-card/95 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-sm">
      <h3 className="mb-1.5 text-xs font-semibold">{t('heritageTree.legend.title')}</h3>
      <div className="flex items-center gap-2 py-0.5">
        <div className="legend-line descent" />
        <span className="text-muted-foreground">{t('heritageTree.legend.descent')}</span>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <div className="legend-line marriage" />
        <span className="text-muted-foreground">{t('heritageTree.legend.marriage')}</span>
      </div>

      {uniqueOrigins.length > 0 && (
        <>
          <div className="mt-2 border-t border-border pt-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('heritageTree.legend.origins')}
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {uniqueOrigins.map((origin) => (
              <span key={origin} className={`origin-tag origin-${origin} w-28 text-center`} style={{ marginTop: 0 }}>
                {originLabel(t, origin)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
