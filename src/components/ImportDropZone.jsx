/**
 * ImportDropZone — drag-and-drop or click to import .mftpkg / database / JSON.
 * Uses Tailwind theme tokens.
 */
import React, { useRef, useState, useCallback } from 'react';
import { IMPORT_ACCEPT } from '../lib/genealogyFileFormats.js';
import { cn } from '../lib/utils.js';
import { GedcomImportReviewSheet } from './GedcomImportReviewSheet.jsx';

export function ImportDropZone({ onImported }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);

  const captureReview = (result) => {
    if (result?.source === 'gedcom' && Array.isArray(result.issues) && result.issues.length > 0) {
      setReviewResult(result);
    }
  };

  const updateProgress = (pct, text) => {
    setProgress({ pct, text });
    setError(false);
  };

  const configureImporterProgress = (importer) => {
    importer.onProgress = (stage, current, total) => {
      const pctMap = {
        loading: 15,
        parsing: 25,
        extracting: 30 + (current / Math.max(total, 1)) * 45,
        importing: 80,
        done: 100,
      };
      const labelMap = {
        loading: 'Reading file…',
        parsing: 'Parsing family tree data…',
        extracting: `Extracting records (step ${current + 1} of ${total})…`,
        importing: 'Saving to IndexedDB…',
        done: 'Done!',
      };
      setProgress({ pct: pctMap[stage] ?? 50, text: labelMap[stage] || stage });
    };
  };

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
          configureImporterProgress(importer);
          result = await importer.importFromFile(file);
        }
        updateProgress(100, `Imported ${result.total || 0} records`);
        captureReview(result);
        onImported?.(result);
      } catch (err) {
        console.error(err);
        setProgress({ pct: 100, text: `Import failed: ${err.message}` });
        setError(true);
      }
    },
    [onImported]
  );

  const handleDirectory = useCallback(async (entry) => {
    updateProgress(5, 'Scanning package folder…');
    const files = await readAllDirectoryFiles(entry);
    const databaseItem = files.find((item) => item.file.name === 'database' || item.path.endsWith('/database'));
    const gedcomItem = files.find((item) => /\.(ged|uged|uged16|gedcom)$/i.test(item.file.name));

    if (!databaseItem && !gedcomItem) {
      setProgress({ pct: 100, text: 'No database or GEDCOM file found in that folder.' });
      setError(true);
      return;
    }

    updateProgress(10, 'Loading importer…');
    const { MFTPKGImporter } = await import('../lib/MFTPKGImporter.js');
    const importer = new MFTPKGImporter();
    configureImporterProgress(importer);
    try {
      if (databaseItem) {
        const resourceItems = files.filter((item) => item.path.includes('/resources/') || item.path.includes('/mediathumbs/'));
        const resourceFiles = [];
        for (const item of resourceItems) {
          resourceFiles.push({
            path: item.path,
            name: item.file.name,
            bytes: new Uint8Array(await item.file.arrayBuffer()),
          });
        }
        const result = await importer.importFromPackageDirectory({
          databaseFile: databaseItem.file,
          sourceName: entry.name || 'MacFamilyTree package',
          resourceFiles,
        });
        updateProgress(100, `Imported ${result.total || 0} records`);
        captureReview(result);
        onImported?.(result);
        return;
      }

      // GEDCOM + sibling media folder drop: bundle every non-GEDCOM file as resourceFiles.
      const mediaItems = files.filter((item) => item !== gedcomItem);
      updateProgress(20, `Reading ${mediaItems.length} media file${mediaItems.length === 1 ? '' : 's'}…`);
      const resourceFiles = [];
      for (const item of mediaItems) {
        resourceFiles.push({
          path: item.path,
          name: item.file.name,
          bytes: new Uint8Array(await item.file.arrayBuffer()),
        });
      }
      const gedBytes = new Uint8Array(await gedcomItem.file.arrayBuffer());
      const result = await importer.importFromBytes(gedBytes, gedcomItem.file.name);
      // importFromBytes routes through _importGedcomBytes but does not currently
      // thread external resourceFiles for the folder case — fall back to the
      // dedicated helper when available.
      if (importer._importGedcomBytes && resourceFiles.length > 0) {
        try {
          const gedResult = await importer._importGedcomBytes(gedBytes, gedcomItem.file.name, { resourceFiles });
          updateProgress(100, `Imported ${gedResult.total || 0} records`);
          captureReview(gedResult);
          onImported?.(gedResult);
          return;
        } catch (err) {
          console.warn('[ImportDropZone] GEDCOM folder import with resources failed, falling back to bare import', err);
        }
      }
      updateProgress(100, `Imported ${result.total || 0} records`);
      captureReview(result);
      onImported?.(result);
    } catch (err) {
      console.error(err);
      setProgress({ pct: 100, text: `Import failed: ${err.message}` });
      setError(true);
    }
  }, [onImported]);

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setDragOver(false);
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const entry = items[0].webkitGetAsEntry ? items[0].webkitGetAsEntry() : null;
        if (entry && entry.isDirectory) {
          await handleDirectory(entry);
          return;
        }
      }
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleDirectory, handleFile]
  );

  const isDone = progress?.pct === 100 && !error;

  return (
    <>
    {reviewResult && (
      <GedcomImportReviewSheet result={reviewResult} onClose={() => setReviewResult(null)} />
    )}
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
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      <p className="sr-only">
        You can also drop a folder containing a GEDCOM file plus its associated media files.
      </p>
      <h2 className="text-lg font-semibold mb-2">Import Family Tree</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Drop a <code>.mftpkg</code> folder, <code>.mftsql</code> file, SQLite <code>database</code>, GEDCOM
        <code>.ged</code>/<code>.uged</code>/<code>.uged16</code>, GedZip <code>.zip</code>, or <code>.json</code> export.
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
          {reviewResult?.issues?.length > 0 && !error && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setReviewResult(reviewResult); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Review {reviewResult.issues.length} GEDCOM import issue{reviewResult.issues.length === 1 ? '' : 's'} →
            </button>
          )}
        </div>
      )}
    </div>
    </>
  );
}

export default ImportDropZone;

function readDirectoryEntries(directoryEntry) {
  const reader = directoryEntry.createReader();
  const entries = [];
  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function readAllDirectoryFiles(directoryEntry, basePath = directoryEntry.name || '') {
  const entries = await readDirectoryEntries(directoryEntry);
  const files = [];
  for (const entry of entries) {
    const path = `${basePath}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...await readAllDirectoryFiles(entry, path));
    } else if (entry.isFile) {
      files.push({ path, file: await entryFile(entry) });
    }
  }
  return files;
}

function entryFile(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}
