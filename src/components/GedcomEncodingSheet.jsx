/**
 * GedcomEncodingSheet — per-import character-encoding prompt, shown when a
 * GEDCOM has non-ASCII content but no BOM or usable `1 CHAR` declaration (the
 * web counterpart of MacFamilyTree's GedcomCustomEncodingSheet). Live-previews
 * the first lines decoded with the chosen encoding so mojibake is obvious
 * before the import runs.
 */
import React, { useMemo, useState } from 'react';
import { Sheet } from './ui/Sheet.jsx';
import { Select } from './ui/Select.jsx';
import { GEDCOM_ENCODINGS, decodeGedcomBytes } from '../lib/genealogyFileFormats.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const PREVIEW_BYTES = 6144;
const PREVIEW_LINES = 14;

export function GedcomEncodingSheet({ fileName, bytes, charTag, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const [encoding, setEncoding] = useState('utf-8');

  const preview = useMemo(() => {
    try {
      const slice = bytes.slice(0, PREVIEW_BYTES);
      return decodeGedcomBytes(slice, fileName, { encoding })
        .split(/\r\n|\r|\n/)
        .slice(0, PREVIEW_LINES)
        .join('\n');
    } catch {
      return '';
    }
  }, [bytes, encoding, fileName]);

  return (
    <Sheet title={t('import.encodingTitle')} onClose={onCancel} maxWidth="max-w-2xl">
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {t('import.encodingBody', { name: fileName })}
          {charTag ? ` ${t('import.encodingCharTag', { tag: charTag })}` : ''}
        </p>
        <Select
          value={encoding}
          onChange={setEncoding}
          options={GEDCOM_ENCODINGS.filter((option) => option.id !== 'auto').map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          ariaLabel={t('import.encodingTitle')}
        />
        <pre dir="auto" className="max-h-56 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">
          {preview || '…'}
        </pre>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(encoding)}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold"
          >
            {t('import.encodingConfirm')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export default GedcomEncodingSheet;
