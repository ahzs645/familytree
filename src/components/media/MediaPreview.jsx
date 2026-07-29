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
        className="text-interactive text-xs break-all hover:underline"
      >
        {record.fields.url.value}
      </a>
    );
  }
  if (!asset?.dataBase64) {
    return <div className="text-muted-foreground text-xs">No local asset stored for this media record.</div>;
  }
  const src = `data:${asset.mimeType || 'application/octet-stream'};base64,${asset.dataBase64}`;
  if (record.recordType === 'MediaPicture') {
    return <img src={src} alt="" className="max-w-full rounded-md border border-border" />;
  }
  if (record.recordType === 'MediaPDF') {
    return <iframe title={asset.filename || record.recordName} src={src} className="w-full h-72 border border-border rounded-md" />;
  }
  if (record.recordType === 'MediaAudio') {
    return <audio controls src={src} className="w-full" />;
  }
  if (record.recordType === 'MediaVideo') {
    return <video controls src={src} className="w-full rounded-md" />;
  }
  return <div className="text-muted-foreground text-xs">{asset.filename || asset.assetId}</div>;
}
