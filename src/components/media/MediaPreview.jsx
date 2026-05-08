/**
 * Render a media record's first asset inline:
 *   - MediaURL    → external <a>
 *   - MediaPicture → <img>
 *   - MediaPDF    → <iframe>
 *   - MediaAudio  → <audio controls>
 *   - MediaVideo  → <video controls>
 *
 * Falls back to a "no asset" message when the record is missing data.
 */
import React from 'react';

export function MediaPreview({ record, assets }) {
  const asset = assets[0];
  if (record.recordType === 'MediaURL' && record.fields?.url?.value) {
    return (
      <a
        href={record.fields.url.value}
        target="_blank"
        rel="noreferrer"
        style={{ color: 'hsl(var(--primary))', fontSize: 12 }}
      >
        {record.fields.url.value}
      </a>
    );
  }
  if (!asset?.dataBase64) {
    return <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>No local asset stored for this media record.</div>;
  }
  const src = `data:${asset.mimeType || 'application/octet-stream'};base64,${asset.dataBase64}`;
  if (record.recordType === 'MediaPicture') {
    return <img src={src} alt="" style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid hsl(var(--border))' }} />;
  }
  if (record.recordType === 'MediaPDF') {
    return <iframe title={asset.filename || record.recordName} src={src} style={{ width: '100%', height: 280, border: '1px solid hsl(var(--border))', borderRadius: 6 }} />;
  }
  if (record.recordType === 'MediaAudio') {
    return <audio controls src={src} style={{ width: '100%' }} />;
  }
  if (record.recordType === 'MediaVideo') {
    return <video controls src={src} style={{ width: '100%', borderRadius: 6 }} />;
  }
  return <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{asset.filename || asset.assetId}</div>;
}
