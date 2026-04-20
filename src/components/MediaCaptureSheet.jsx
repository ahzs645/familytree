import React, { useEffect, useRef, useState } from 'react';

/**
 * MediaCaptureSheet — unified capture sheet for picture/audio/video/scan.
 *
 * Mac reference: ScanPictureSheet, RecordPictureSheet, RecordAudioSheet,
 * RecordVideoSheet in Base.lproj.
 *
 * Props:
 *   mode: 'picture' | 'audio' | 'video' | 'scan'
 *   onApply({ blob, dataUrl, mimeType, mode })
 *   onCancel()
 *
 * 'scan' uses the same video stream but prefers the rear camera.
 */
export function MediaCaptureSheet({ mode = 'picture', onApply, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const constraints = mode === 'audio'
          ? { audio: true }
          : {
              audio: mode === 'video',
              video: mode === 'scan'
                ? { facingMode: { ideal: 'environment' } }
                : { facingMode: 'user' },
            };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current && mode !== 'audio') {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        setError(err?.message || 'Camera/microphone access denied.');
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [mode]);

  const captureStill = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const dataUrl = canvas.toDataURL('image/png');
      setPreview({ kind: 'image', dataUrl, blob });
    }, 'image/png');
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = mode === 'audio'
      ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '')
      : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
      const url = URL.createObjectURL(blob);
      setPreview({ kind: mode === 'audio' ? 'audio' : 'video', url, blob });
      setRecording(false);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => recorderRef.current?.stop();

  const apply = async () => {
    if (!preview) return;
    if (preview.dataUrl) {
      onApply({ blob: preview.blob, dataUrl: preview.dataUrl, mimeType: 'image/png', mode });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onApply({ blob: preview.blob, dataUrl: reader.result, mimeType: preview.blob.type, mode });
    reader.readAsDataURL(preview.blob);
  };

  const labels = {
    picture: 'Record picture',
    scan: 'Scan picture',
    audio: 'Record audio',
    video: 'Record video',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{labels[mode] || 'Capture'}</h2>
        </header>
        <div className="p-4 space-y-3">
          {error ? (
            <div className="text-xs text-destructive">{error}</div>
          ) : mode === 'audio' ? (
            <div className="text-xs text-muted-foreground">Microphone active. Click Record to start.</div>
          ) : (
            <video ref={videoRef} playsInline muted className="w-full rounded-md bg-black/60" style={{ maxHeight: '50vh' }} />
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {preview && preview.kind === 'image' && (
            <img src={preview.dataUrl} alt="preview" className="w-full rounded-md border border-border" />
          )}
          {preview && preview.kind === 'audio' && (
            <audio controls src={preview.url} className="w-full" />
          )}
          {preview && preview.kind === 'video' && (
            <video controls src={preview.url} className="w-full rounded-md" style={{ maxHeight: '40vh' }} />
          )}

          <div className="flex items-center justify-center gap-2">
            {(mode === 'picture' || mode === 'scan') && (
              <button onClick={captureStill} disabled={!streamRef.current} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50">Capture</button>
            )}
            {(mode === 'audio' || mode === 'video') && (
              recording
                ? <button onClick={stopRecording} className="bg-destructive text-destructive-foreground rounded-md px-3 py-1.5 text-xs font-semibold">Stop</button>
                : <button onClick={startRecording} disabled={!streamRef.current} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Record</button>
            )}
            {preview && (
              <button onClick={() => setPreview(null)} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Retake</button>
            )}
          </div>
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
          <button type="button" onClick={apply} disabled={!preview} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50">Save</button>
        </footer>
      </div>
    </div>
  );
}

export default MediaCaptureSheet;
