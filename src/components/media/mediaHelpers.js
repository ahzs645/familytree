/**
 * Small browser helpers shared by the Media route, the capture hook,
 * and the in-place image editor. Pure utilities — no React, no DB.
 */

export function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

export function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode this image.'));
    }, type);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The stored image could not be decoded.'));
    image.src = src;
  });
}

export function editedFilename(fileName, operation, mimeType) {
  const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';
  const base = String(fileName || 'image').replace(/\.[^.]+$/, '');
  return `${base}-${operation}${ext}`;
}
