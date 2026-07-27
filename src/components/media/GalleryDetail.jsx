/**
 * Read-only "gallery report" sidebar — used when /views/media-gallery
 * (or `mode=gallery`) is active. Shows the record's title, a preview,
 * the description, and a list of related records with click-through.
 *
 * On mobile the parent renders this full-width with a back button; on
 * desktop it sits as a 420px fixed aside.
 */
import React from 'react';
import { readRef } from '../../lib/schema.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/Button.jsx';
import { recordDisplayLabel } from '../editors/RelatedRecordEditors.jsx';
import { MediaPreview } from './MediaPreview.jsx';

function routeForRecord(record) {
  if (!record) return null;
  if (record.recordType === 'Person') return `/person/${record.recordName}`;
  if (record.recordType === 'Family') return `/family/${record.recordName}`;
  if (record.recordType === 'Place') return `/places?placeId=${encodeURIComponent(record.recordName)}`;
  if (record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent') {
    return `/events?eventId=${encodeURIComponent(record.recordName)}`;
  }
  if (record.recordType?.startsWith('Media')) {
    return `/views/media-gallery?mediaId=${encodeURIComponent(record.recordName)}`;
  }
  return null;
}

export function GalleryDetail({ record, assets, relations, onOpenRelated, isMobile = false, onClose }) {
  const title = record.fields?.caption?.value
    || record.fields?.filename?.value
    || record.fields?.fileName?.value
    || record.fields?.url?.value
    || record.recordName;
  const description = record.fields?.description?.value
    || record.fields?.userDescription?.value
    || '';

  return (
    <aside
      className={cn(
        'bg-card text-card-foreground overflow-auto',
        isMobile ? 'w-full flex-1 p-4' : 'w-[420px] border-s border-border p-5',
      )}
    >
      {isMobile && onClose && (
        <Button variant="destructiveOutline" onClick={onClose} className="mb-2.5" aria-label="Back to gallery">← Back</Button>
      )}
      <div className="mb-3.5">
        <div className="text-muted-foreground text-xs uppercase tracking-wide">
          {record.recordType.replace('Media', '')}
        </div>
        <h2 className="text-base text-foreground mt-1 mb-0 font-bold leading-tight">
          {title}
        </h2>
      </div>
      <div className="border border-border rounded-md p-2.5 bg-background mb-3.5">
        <MediaPreview record={record} assets={assets} />
      </div>
      {description && (
        <div className="mb-3.5">
          <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
            Description
          </div>
          <div className="text-foreground text-sm leading-relaxed">{description}</div>
        </div>
      )}
      <div>
        <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1.5">
          Related Entries
        </div>
        {relations.length === 0 ? (
          <div className="text-muted-foreground text-xs">No related entries.</div>
        ) : (
          <div className="grid gap-1.5">
            {relations.map(({ rel, target }) => (
              <button
                key={rel.recordName}
                type="button"
                onClick={() => onOpenRelated(target)}
                className={cn(
                  'text-xs bg-secondary text-secondary-foreground border border-border rounded-md p-2 text-start',
                  routeForRecord(target) ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
                )}
              >
                <span className="text-muted-foreground me-1.5">
                  {rel.fields?.targetType?.value || target?.recordType || 'Record'}
                </span>
                {recordDisplayLabel(target) || target?.recordName || readRef(rel.fields?.target)}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
