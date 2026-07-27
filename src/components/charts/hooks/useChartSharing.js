/**
 * Share actions for the current chart: build the compressed read-only share
 * URL from the serialized document, copy it, hand it to the system share
 * sheet, open a mailto draft, or render it as a QR code (`qrShare` holds the
 * open QR dialog's payload).
 */
import { useCallback, useState } from 'react';
import { buildShareUrl } from '../../../lib/chartShareLink.js';
import { copyTextToClipboard } from '../../../lib/clipboard.js';
import { useModal } from '../../../contexts/ModalContext.jsx';

export function useChartSharing({ rootId, chartTitle, currentDocumentId, currentDocumentName, currentDocumentState }) {
  const modal = useModal();
  const [qrShare, setQrShare] = useState(null);

  const buildChartShareUrl = useCallback(async () => {
    const doc = currentDocumentState(currentDocumentName || 'Shared Chart', currentDocumentId || 'shared');
    return buildShareUrl(doc, {
      baseUrl: window.location.origin,
      basePath: import.meta.env?.BASE_URL || '/',
    });
  }, [currentDocumentState, currentDocumentName, currentDocumentId]);

  const onCopyShareLink = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before creating a share link.');
      return;
    }
    try {
      const { url, token } = await buildChartShareUrl();
      const copied = await copyTextToClipboard(url);
      if (!copied) {
        // Clipboard unavailable (insecure origin / permission denied) — show
        // the link so the user can copy it manually.
        await modal.prompt('Copy the share link:', url, { title: 'Share link' });
        return;
      }
      const size = Math.round(token.length / 1024 * 10) / 10;
      modal.toast(`Token size: ~${size}KB\nLink length: ${url.length.toLocaleString()} characters`, {
        title: 'Share link copied',
        kind: 'success',
      });
    } catch (error) {
      console.error('[ChartsApp] share-link failed', error);
      await modal.alert(`Share link failed: ${error.message}`, { title: 'Share link failed' });
    }
  }, [rootId, buildChartShareUrl, modal]);

  const onShareChart = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before sharing.');
      return;
    }
    try {
      const { url } = await buildChartShareUrl();
      const title = currentDocumentName || chartTitle || 'Family chart';
      if (navigator.share) {
        await navigator.share({ title, text: `View ${title}`, url });
        return;
      }
      const copied = await copyTextToClipboard(url);
      await modal.alert(
        copied
          ? `Share dialog not supported on this browser. Link copied:\n\n${url}`
          : `Share dialog not supported on this browser. Copy the link manually:\n\n${url}`,
        { title: 'Share' }
      );
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('[ChartsApp] share failed', error);
      await modal.alert(`Share failed: ${error.message}`, { title: 'Share failed' });
    }
  }, [rootId, buildChartShareUrl, currentDocumentName, chartTitle, modal]);

  const onShareByEmail = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before sharing.');
      return;
    }
    try {
      const { url } = await buildChartShareUrl();
      const title = currentDocumentName || chartTitle || 'Family chart';
      const subject = encodeURIComponent(title);
      const body = encodeURIComponent(`${title}\n\n${url}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (error) {
      console.error('[ChartsApp] share-email failed', error);
      await modal.alert(`Email share failed: ${error.message}`, { title: 'Email share failed' });
    }
  }, [rootId, buildChartShareUrl, currentDocumentName, chartTitle, modal]);

  const onShowShareQr = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before creating a QR code.');
      return;
    }
    try {
      const { url } = await buildChartShareUrl();
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
      setQrShare({ url, dataUrl, title: currentDocumentName || chartTitle || 'Family chart' });
    } catch (error) {
      await modal.alert(`QR code failed: ${error.message}`, { title: 'QR code failed' });
    }
  }, [rootId, buildChartShareUrl, currentDocumentName, chartTitle, modal]);

  return {
    qrShare,
    setQrShare,
    buildChartShareUrl,
    onCopyShareLink,
    onShareChart,
    onShareByEmail,
    onShowShareQr,
  };
}
