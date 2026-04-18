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
