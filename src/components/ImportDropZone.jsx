/**
 * ImportDropZone — drag-and-drop or click to import a .mftpkg / database / JSON file.
 * Wraps the existing MFTPKGImporter. On success, calls onImported(result).
 */
import React, { useRef, useState, useCallback } from 'react';

const ACCENT = '#6c8aff';
const RED = '#f87171';
const GREEN = '#4ade80';

export function ImportDropZone({ onImported }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null); // { pct, text, color }

  const updateProgress = (pct, text, color = ACCENT) => setProgress({ pct, text, color });

  const findDatabaseInDirectory = (dirEntry) =>
    new Promise((resolve) => {
      dirEntry.createReader().readEntries((entries) => {
        for (const e of entries) {
          if (e.isFile && e.name === 'database') {
            e.file((file) => resolve(file));
            return;
          }
        }
        resolve(null);
      });
    });

  const handleFile = useCallback(
    async (file) => {
      updateProgress(5, 'Reading file…');
      try {
        updateProgress(10, 'Loading SQLite engine (WebAssembly)…');
        const { MFTPKGImporter } = await import('../lib/MFTPKGImporter.js');
        const importer = new MFTPKGImporter();

        let result;
        if (file.name.endsWith('.json')) {
          updateProgress(30, 'Parsing JSON…');
          const text = await file.text();
          const data = JSON.parse(text);
          updateProgress(60, 'Saving to IndexedDB…');
          result = await importer.importFromJSON(data);
        } else {
          importer.onProgress = (stage, current, total) => {
            const pctMap = {
              loading: 15,
              parsing: 25,
              extracting: 30 + (current / Math.max(total, 1)) * 45,
              importing: 80,
              done: 100,
            };
            const labelMap = {
              loading: 'Reading database file…',
              parsing: 'Parsing SQLite…',
              extracting: `Extracting records (step ${current + 1} of ${total})…`,
              importing: 'Saving to IndexedDB…',
              done: 'Done!',
            };
            setProgress({ pct: pctMap[stage] ?? 50, text: labelMap[stage] || stage, color: ACCENT });
          };
          result = await importer.importFromFile(file);
        }

        updateProgress(100, `Imported ${result.total || 0} records`, GREEN);
        onImported?.(result);
      } catch (err) {
        console.error(err);
        updateProgress(100, `Import failed: ${err.message}`, RED);
      }
    },
    [onImported]
  );

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setDragOver(false);
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const entry = items[0].webkitGetAsEntry ? items[0].webkitGetAsEntry() : null;
        if (entry && entry.isDirectory) {
          updateProgress(5, 'Scanning .mftpkg folder…');
          const dbFile = await findDatabaseInDirectory(entry);
          if (dbFile) {
            handleFile(dbFile);
            return;
          }
          updateProgress(100, 'No “database” file found inside that folder.', RED);
          return;
        }
      }
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      style={{
        ...zone,
        borderColor: dragOver ? ACCENT : '#2e3345',
        background: dragOver ? '#161b2d' : '#13161f',
      }}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      <h2 style={title}>Import Family Tree</h2>
      <p style={hint}>
        Drop a <code>.mftpkg</code> folder, the inner <code>database</code> file, or a <code>.json</code> export.
        Data is stored locally in your browser’s IndexedDB and never leaves your device.
      </p>
      {progress && (
        <div style={progressWrap}>
          <div style={progressTrack}>
            <div style={{ ...progressBar, width: `${progress.pct}%`, background: progress.color }} />
          </div>
          <div style={{ ...progressText, color: progress.color }}>{progress.text}</div>
        </div>
      )}
    </div>
  );
}

const zone = {
  border: '2px dashed #2e3345',
  borderRadius: 14,
  padding: 32,
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
};
const title = { margin: '0 0 8px', fontSize: 18, color: '#e2e4eb' };
const hint = { margin: 0, fontSize: 13, color: '#8b90a0', lineHeight: 1.6 };
const progressWrap = { marginTop: 18 };
const progressTrack = { height: 8, borderRadius: 6, background: '#0f1117', overflow: 'hidden', border: '1px solid #2e3345' };
const progressBar = { height: '100%', transition: 'width 0.4s ease-out' };
const progressText = { marginTop: 10, fontSize: 12 };

export default ImportDropZone;
