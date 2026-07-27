/**
 * Modal dialog showing the QR code for a chart share link.
 * `qrShare` is the payload built by useChartSharing's onShowShareQr:
 * { url, dataUrl, title }.
 */
import React from 'react';
import { copyTextToClipboard } from '../../../lib/clipboard.js';

export function ChartShareQrDialog({ qrShare, onClose }) {
  if (!qrShare) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6" onClick={onClose}>
      <div className="rounded-lg border border-border bg-card p-5 shadow-xl w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold truncate">{qrShare.title}</div>
          <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <img src={qrShare.dataUrl} alt="Chart share QR code" className="w-60 h-60 mx-auto bg-white rounded-md p-2" />
        <button
          type="button"
          onClick={() => copyTextToClipboard(qrShare.url)}
          className="mt-4 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm hover:bg-accent"
        >
          Copy link
        </button>
      </div>
    </div>
  );
}
