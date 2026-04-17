/**
 * ImportDropZone — drag-and-drop or click to import .mftpkg / database / JSON.
 * Uses Tailwind theme tokens.
 */
import React, { useRef, useState, useCallback } from 'react';
import { cn } from '../lib/utils.js';

export function ImportDropZone({ onImported }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(false);

  const updateProgress = (pct, text) => {
    setProgress({ pct, text });
    setError(false);
  };

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
        updateProgress(10, 'Loading SQLite engine…');
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
              loading: 'Reading database…',
              parsing: 'Parsing SQLite…',
              extracting: `Extracting records (step ${current + 1} of ${total})…`,
              importing: 'Saving to IndexedDB…',
              done: 'Done!',
            };
            setProgress({ pct: pctMap[stage] ?? 50, text: labelMap[stage] || stage });
          };
          result = await importer.importFromFile(file);
        }
        updateProgress(100, `Imported ${result.total || 0} records`);
        onImported?.(result);
      } catch (err) {
        console.error(err);
        setProgress({ pct: 100, text: `Import failed: ${err.message}` });
        setError(true);
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
          if (dbFile) return handleFile(dbFile);
          setProgress({ pct: 100, text: 'No “database” file inside that folder.' });
          setError(true);
          return;
        }
      }
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const isDone = progress?.pct === 100 && !error;

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors',
        dragOver ? 'border-primary bg-accent' : 'border-border bg-card hover:border-muted-foreground/40'
      )}
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
        className="hidden"
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      <h2 className="text-lg font-semibold mb-2">Import Family Tree</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Drop a <code>.mftpkg</code> folder, the inner <code>database</code> file, or a <code>.json</code> export.
        Data is stored locally in your browser&rsquo;s IndexedDB and never leaves your device.
      </p>
      {progress && (
        <div className="mt-5">
          <div className="h-2 rounded-md bg-secondary border border-border overflow-hidden">
            <div
              className={cn(
                'h-full transition-[width] duration-300',
                error ? 'bg-destructive' : isDone ? 'bg-emerald-500' : 'bg-primary'
              )}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div
            className={cn(
              'mt-2 text-xs',
              error ? 'text-destructive' : isDone ? 'text-emerald-500' : 'text-muted-foreground'
            )}
          >
            {progress.text}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportDropZone;
