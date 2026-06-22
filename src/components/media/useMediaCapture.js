/**
 * Camera + microphone capture state for the Media gallery.
 *
 * The hook owns all of the device lifecycle: getting a stream, attaching
 * it to a <video> ref, recording with MediaRecorder, and tearing the
 * stream down on cancel/save/unmount. Callers provide:
 *
 * - setStatus    — short status string for the gallery toolbar
 * - reload       — re-fetches the media list after a save
 * - setActiveId  — selects the newly-created record after a save
 *
 * Returns the inputs the gallery JSX needs (`videoRef`, `captureMode`,
 * `recording`, plus the `onStartCamera/onCapturePhoto/onStartAudioRecording
 * /onStopAudioRecording/onCancelCapture` actions). The video tag in the
 * JSX is wired up via `videoRef`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createMediaRecordFromBlob } from '../../lib/mediaFolderMatch.js';
import { canvasToBlob, stopStream } from './mediaHelpers.js';

export function useMediaCapture({ setStatus, reload, setActiveId }) {
  const [captureMode, setCaptureMode] = useState(null);
  const [captureStream, setCaptureStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const audioCanceledRef = useRef(false);

  // Wire the active stream to the <video> element for camera + video modes.
  useEffect(() => {
    if ((captureMode !== 'camera' && captureMode !== 'video') || !videoRef.current || !captureStream) return;
    videoRef.current.srcObject = captureStream;
    videoRef.current.play().catch(() => {});
  }, [captureMode, captureStream]);

  // On unmount or stream change, release the prior stream.
  useEffect(() => () => {
    stopStream(captureStream);
  }, [captureStream]);

  const onStartCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera capture is not available in this browser.');
      return;
    }
    setStatus('Starting camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCaptureStream(stream);
      setCaptureMode('camera');
      setStatus('Camera ready.');
    } catch (error) {
      setStatus(`Camera failed: ${error.message}`);
    }
  }, [setStatus]);

  const onCapturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setStatus('Camera preview is not ready yet.');
      return;
    }
    setStatus('Capturing photo…');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, 'image/png');
      const record = await createMediaRecordFromBlob(blob, {
        filename: `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
        caption: 'Camera capture',
        recordType: 'MediaPicture',
      });
      stopStream(captureStream);
      setCaptureStream(null);
      setCaptureMode(null);
      await reload();
      setActiveId(record.recordName);
      setStatus('Photo captured.');
    } catch (error) {
      setStatus(`Photo capture failed: ${error.message}`);
    }
  }, [captureStream, reload, setActiveId, setStatus]);

  const onStartAudioRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus('Audio recording is not available in this browser.');
      return;
    }
    setStatus('Starting audio recorder…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const recorder = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      audioCanceledRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const canceled = audioCanceledRef.current;
        stopStream(stream);
        setCaptureStream(null);
        setCaptureMode(null);
        setRecording(false);
        if (canceled) {
          setStatus('Audio recording canceled.');
          return;
        }
        try {
          const type = recorder.mimeType || 'audio/webm';
          const blob = new Blob(recorderChunksRef.current, { type });
          const extension = type.includes('mp4') || type.includes('m4a') ? 'm4a' : type.includes('mpeg') ? 'mp3' : 'webm';
          const record = await createMediaRecordFromBlob(blob, {
            filename: `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
            caption: 'Audio recording',
            recordType: 'MediaAudio',
          });
          await reload();
          setActiveId(record.recordName);
          setStatus('Audio recording saved.');
        } catch (error) {
          setStatus(`Audio save failed: ${error.message}`);
        }
      };
      mediaRecorderRef.current = recorder;
      setCaptureStream(stream);
      setCaptureMode('audio');
      setRecording(true);
      recorder.start();
      setStatus('Recording audio…');
    } catch (error) {
      setStatus(`Audio recording failed: ${error.message}`);
    }
  }, [reload, setActiveId, setStatus]);

  const onStopAudioRecording = useCallback(() => {
    audioCanceledRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const onStartVideoRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus('Video recording is not available in this browser.');
      return;
    }
    setStatus('Starting video recorder…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const recorder = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      audioCanceledRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const canceled = audioCanceledRef.current;
        stopStream(stream);
        setCaptureStream(null);
        setCaptureMode(null);
        setRecording(false);
        if (canceled) {
          setStatus('Video recording canceled.');
          return;
        }
        try {
          const type = recorder.mimeType || 'video/webm';
          const extension = type.includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(recorderChunksRef.current, { type });
          const record = await createMediaRecordFromBlob(blob, {
            filename: `video-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
            caption: 'Video recording',
            recordType: 'MediaVideo',
          });
          await reload();
          setActiveId(record.recordName);
          setStatus('Video recording saved.');
        } catch (error) {
          setStatus(`Video save failed: ${error.message}`);
        }
      };
      mediaRecorderRef.current = recorder;
      setCaptureStream(stream);
      setCaptureMode('video');
      setRecording(true);
      recorder.start();
      setStatus('Recording video…');
    } catch (error) {
      setStatus(`Video recording failed: ${error.message}`);
    }
  }, [reload, setActiveId, setStatus]);

  // Video uses the same recorder-stop path as audio.
  const onStopVideoRecording = onStopAudioRecording;

  const onCancelCapture = useCallback(() => {
    audioCanceledRef.current = true;
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }
    stopStream(captureStream);
    setCaptureStream(null);
    setCaptureMode(null);
    setRecording(false);
    setStatus('Capture canceled.');
  }, [captureStream, setStatus]);

  return {
    captureMode,
    captureStream,
    recording,
    videoRef,
    onStartCamera,
    onCapturePhoto,
    onStartAudioRecording,
    onStopAudioRecording,
    onStartVideoRecording,
    onStopVideoRecording,
    onCancelCapture,
  };
}
