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
import { recordDisplayLabel } from '../editors/RelatedRecordEditors.jsx';
import { MediaPreview } from './MediaPreview.jsx';

const detailDesktop = {
  width: 420,
  borderInlineStart: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  padding: 20,
  overflow: 'auto',
};

const detailMobile = {
  width: '100%',
  flex: 1,
  background: 'hsl(var(--card))',
  padding: 16,
  overflow: 'auto',
};

const backBtn = {
  background: 'transparent',
  color: 'hsl(var(--destructive))',
  border: '1px solid #3a2d30',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  marginBottom: 10,
};

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
    <aside style={isMobile ? detailMobile : detailDesktop}>
      {isMobile && onClose && (
        <button onClick={onClose} style={backBtn} aria-label="Back to gallery">← Back</button>
      )}
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {record.recordType.replace('Media', '')}
        </div>
        <h2 style={{ fontSize: 16, color: 'hsl(var(--foreground))', margin: '4px 0 0', fontWeight: 700, lineHeight: 1.25 }}>
          {title}
        </h2>
      </div>
      <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 10, background: 'hsl(var(--background))', marginBottom: 14 }}>
        <MediaPreview record={record} assets={assets} />
      </div>
      {description && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
            Description
          </div>
          <div style={{ color: 'hsl(var(--foreground))', fontSize: 13, lineHeight: 1.55 }}>{description}</div>
        </div>
      )}
      <div>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
          Related Entries
        </div>
        {relations.length === 0 ? (
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>No related entries.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {relations.map(({ rel, target }) => (
              <button
                key={rel.recordName}
                type="button"
                onClick={() => onOpenRelated(target)}
                style={{
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                  background: 'hsl(var(--secondary))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  padding: 8,
                  textAlign: 'left',
                  cursor: routeForRecord(target) ? 'pointer' : 'default',
                }}
              >
                <span style={{ color: 'hsl(var(--muted-foreground))', marginRight: 6 }}>
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
