import { getLocalDatabase } from './LocalDatabase.js';

const IDENTIFIER_FIELDS = [
  'audioFileIdentifier',
  'pdfFileIdentifier',
  'originalPictureFileIdentifier',
  'pictureFileIdentifier',
  'thumbnailFileIdentifier',
  'videoFileIdentifier',
  'filename',
  'fileName',
];

export async function matchMediaFiles(files) {
  const db = getLocalDatabase();
  const allMedia = [];
  for (const type of ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo']) {
    const { records } = await db.query(type, { limit: 100000 });
    allMedia.push(...records);
  }
  const fileIndex = new Map();
  for (const file of files) {
    fileIndex.set(file.name, file);
    fileIndex.set(file.name.toLowerCase(), file);
  }

  const assets = [];
  const saveRecords = [];
  for (const media of allMedia) {
    const match = findFileForMedia(media, fileIndex);
    if (!match) continue;
    const dataBase64 = await fileToBase64(match);
    const assetId = `asset-${media.recordName}-${match.name}-${Date.now().toString(36)}`;
    assets.push({
      assetId,
      ownerRecordName: media.recordName,
      sourceIdentifier: match.name,
      filename: match.name,
      mimeType: match.type || 'application/octet-stream',
      size: match.size,
      dataBase64,
    });
    saveRecords.push({
      ...media,
      fields: {
        ...media.fields,
        assetIds: { value: [...(media.fields?.assetIds?.value || []), assetId], type: 'LIST' },
        filename: { value: match.name, type: 'STRING' },
      },
    });
  }
  await db.applyRecordTransaction({ saveRecords, saveAssets: assets });
  return { matched: assets.length };
}

export async function createMediaRecordsFromFiles(files) {
  const db = getLocalDatabase();
  const saveRecords = [];
  const saveAssets = [];
  for (const file of files || []) {
    const recordType = mediaTypeForFile(file);
    const recordName = `${recordType.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const assetId = `asset-${recordName}-${file.name}-${Date.now().toString(36)}`;
    const identifierField = identifierFieldForType(recordType);
    const title = file.name.replace(/\.[^.]+$/, '') || file.name;
    const record = {
      recordName,
      recordType,
      fields: {
        caption: { value: title, type: 'STRING' },
        filename: { value: file.name, type: 'STRING' },
        fileName: { value: file.name, type: 'STRING' },
        assetIds: { value: [assetId], type: 'LIST' },
      },
    };
    if (identifierField) record.fields[identifierField] = { value: file.name, type: 'STRING' };
    saveRecords.push(record);
    saveAssets.push({
      assetId,
      ownerRecordName: recordName,
      sourceIdentifier: file.name,
      filename: file.name,
      mimeType: file.type || mimeTypeForName(file.name),
      size: file.size,
      dataBase64: await fileToBase64(file),
    });
  }
  await db.applyRecordTransaction({ saveRecords, saveAssets });
  return { created: saveRecords.length, records: saveRecords };
}

export async function createMediaURLRecord(url, { caption = '' } = {}) {
  const value = String(url || '').trim();
  if (!value) throw new Error('URL is required.');
  const db = getLocalDatabase();
  const record = {
    recordName: `mediaurl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    recordType: 'MediaURL',
    fields: {
      url: { value, type: 'STRING' },
      caption: { value: caption || value, type: 'STRING' },
    },
  };
  await db.saveRecord(record);
  return record;
}

function findFileForMedia(media, fileIndex) {
  for (const fieldName of IDENTIFIER_FIELDS) {
    const value = media.fields?.[fieldName]?.value;
    if (!value) continue;
    const base = String(value).split('/').pop();
    if (fileIndex.has(base)) return fileIndex.get(base);
    if (fileIndex.has(base.toLowerCase())) return fileIndex.get(base.toLowerCase());
  }
  return null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}

function mediaTypeForFile(file) {
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif|tiff?)$/.test(name)) return 'MediaPicture';
  if (type === 'application/pdf' || /\.pdf$/.test(name)) return 'MediaPDF';
  if (type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|aiff?|ogg|flac)$/.test(name)) return 'MediaAudio';
  if (type.startsWith('video/') || /\.(mov|mp4|m4v|webm|avi)$/.test(name)) return 'MediaVideo';
  return 'MediaPDF';
}

function identifierFieldForType(recordType) {
  return {
    MediaPicture: 'pictureFileIdentifier',
    MediaPDF: 'pdfFileIdentifier',
    MediaAudio: 'audioFileIdentifier',
    MediaVideo: 'videoFileIdentifier',
  }[recordType] || null;
}

function mimeTypeForName(fileName) {
  const name = String(fileName || '').toLowerCase();
  if (/\.(png)$/.test(name)) return 'image/png';
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (/\.(gif)$/.test(name)) return 'image/gif';
  if (/\.(webp)$/.test(name)) return 'image/webp';
  if (/\.(pdf)$/.test(name)) return 'application/pdf';
  if (/\.(mp3)$/.test(name)) return 'audio/mpeg';
  if (/\.(wav)$/.test(name)) return 'audio/wav';
  if (/\.(mp4|m4v)$/.test(name)) return 'video/mp4';
  if (/\.(mov)$/.test(name)) return 'video/quicktime';
  if (/\.(webm)$/.test(name)) return 'video/webm';
  return 'application/octet-stream';
}
