/**
 * BooksApp — compose a multi-section book, preview compiled output, save/load,
 * and export using the same report exporters.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { listAllPersons } from '../../lib/treeQuery.js';
import {
  SECTION_KINDS,
  listBooks,
  saveBook,
  deleteBook,
  compileBook,
  newBookId,
  downloadBookHTML,
  downloadBookBundle,
  validateBook,
} from '../../lib/books.js';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { readField } from '../../lib/schema.js';
import { EXPORT_FORMATS, downloadReport } from '../../lib/reports/export.js';
import { compareStrings, formatInteger } from '../../lib/i18n.js';
import { sourceSummary } from '../../models/index.js';
import { SectionEditor } from './SectionEditor.jsx';
import { ReportPreview } from '../reports/ReportPreview.jsx';

function blankBook() {
  return {
    id: null,
    title: 'My Family Book',
    sections: [
      { kind: 'cover', text: 'My Family Book', subtitle: '', author: '', date: '' },
      { kind: 'toc', tocStyle: 'numbered' },
    ],
  };
}

export function BooksApp() {
  const [persons, setPersons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sources, setSources] = useState([]);
  const [book, setBook] = useState(blankBook());
  const [compiled, setCompiled] = useState(null);
  const [savedBooks, setSavedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);
  const [validation, setValidation] = useState({ errors: [], warnings: [] });
  const controllerRef = React.useRef(null);

  useEffect(() => {
    (async () => {
      const db = getLocalDatabase();
      const list = await listAllPersons();
      setPersons(list);
      setSavedBooks(await listBooks());
      const [groupRows, sourceRows] = await Promise.all([
        db.query('PersonGroup', { limit: 100000 }),
        db.query('Source', { limit: 100000 }),
      ]);
      setGroups(groupRows.records.map((group) => ({
        recordName: group.recordName,
        label: readField(group, ['name', 'title'], group.recordName),
      })).sort((a, b) => compareStrings(a.label, b.label)));
      setSources(sourceRows.records.map((source) => ({
        recordName: source.recordName,
        label: sourceSummary(source)?.title || source.recordName,
      })).sort((a, b) => compareStrings(a.label, b.label)));
      setLoading(false);
      if (list.length === 0) setEmpty(true);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, v] = await Promise.all([compileBook(book), validateBook(book)]);
      if (!cancelled) {
        setCompiled(r);
        setValidation(v);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book]);

  const guardedExport = useCallback((next, label = 'Export') => {
    if (validation.errors.length > 0) {
      const proceed = confirm(
        `${label} is blocked by ${validation.errors.length} error(s):\n\n` +
        validation.errors.slice(0, 6).map((e) => `• ${e.message}`).join('\n') +
        (validation.errors.length > 6 ? '\n…' : '') +
        '\n\nProceed anyway?'
      );
      if (!proceed) return;
    }
    next();
  }, [validation.errors]);

  const updateSection = useCallback((i, next) => {
    setBook((b) => ({ ...b, sections: b.sections.map((s, j) => (j === i ? next : s)) }));
  }, []);

  const addSection = useCallback((kind) => {
    const def = SECTION_KINDS.find((k) => k.id === kind);
    const section = { kind };
    if (def?.needsPerson) section.targetRecordName = persons[0]?.recordName;
    if (def?.needsGenerations) section.generations = 5;
    if (def?.needsGroup) section.groupRecordName = groups[0]?.recordName || '';
    if (def?.needsSource) section.sourceRecordName = sources[0]?.recordName || '';
    if (kind === 'title' || kind === 'cover') section.text = kind === 'cover' ? book.title : 'New Section';
    if (kind === 'toc') section.tocStyle = 'numbered';
    setBook((b) => ({ ...b, sections: [...b.sections, section] }));
  }, [book.title, groups, persons, sources]);

  const removeSection = useCallback((i) => {
    setBook((b) => ({ ...b, sections: b.sections.filter((_, j) => j !== i) }));
  }, []);

  const moveSection = useCallback((i, dir) => {
    setBook((b) => {
      const next = [...b.sections];
      const j = i + dir;
      if (j < 0 || j >= next.length) return b;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...b, sections: next };
    });
  }, []);

  const onSave = useCallback(async () => {
    const name = prompt('Save book as:', book.title);
    if (!name) return;
    const toSave = { ...book, id: book.id || newBookId(), title: name };
    await saveBook(toSave);
    setBook(toSave);
    setSavedBooks(await listBooks());
  }, [book]);

  const onLoad = useCallback(async (id) => {
    const entry = savedBooks.find((b) => b.id === id);
    if (!entry) return;
    setBook(entry);
  }, [savedBooks]);

  const onDelete = useCallback(async (id) => {
    if (!confirm('Delete this book?')) return;
    await deleteBook(id);
    setSavedBooks(await listBooks());
  }, []);

  const onExport = useCallback((fmt) => {
    if (!compiled) return;
    guardedExport(() => downloadReport(fmt, compiled, { filenameBase: book.title }), `Export as ${fmt.toUpperCase()}`);
  }, [compiled, book.title, guardedExport]);

  const onWebHTML = useCallback(async () => {
    guardedExport(async () => {
      setBusy(true);
      setStatus('Exporting web HTML...');
      try {
        await downloadBookHTML(book, { filenameBase: book.title });
        setStatus('Book HTML downloaded.');
      } catch (error) {
        setStatus(`Book HTML export failed: ${error.message}`);
      }
      setBusy(false);
    }, 'Web HTML export');
  }, [book, guardedExport]);

  const onPDF = useCallback(() => {
    if (!compiled) return;
    guardedExport(() => {
      setStatus('Opening PDF preview...');
      try {
        downloadReport('pdf', compiled, { filenameBase: book.title });
        setStatus('PDF preview opened.');
      } catch (error) {
        setStatus(`PDF preview failed: ${error.message}`);
      }
    }, 'PDF preview');
  }, [book.title, compiled, guardedExport]);

  const onBundle = useCallback(async () => {
    setBusy(true);
    setStatus('Building publish bundle...');
    setProgress(null);
    if (validation.errors.length > 0) {
      const proceed = confirm(`Bundle is blocked by ${validation.errors.length} error(s). Proceed anyway?`);
      if (!proceed) { setBusy(false); return; }
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await downloadBookBundle(book, {
        includeWebsite: true,
        siteOptions: { siteTitle: book.title },
        signal: controller.signal,
        onProgress: setProgress,
      });
      const sitePart = result.website ? ` Website pages: ${formatInteger(result.website.pages)}.` : '';
      setStatus(`Book bundle downloaded with ${formatInteger(result.sections)} sections.${sitePart}`);
    } catch (error) {
      if (error.name === 'AbortError') setStatus('Book bundle export canceled.');
      else setStatus(`Book bundle export failed: ${error.message}`);
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  }, [book]);

  if (loading) return <div style={loadingStyle}>Loading…</div>;
  if (empty) {
    return (
      <div style={loadingStyle}>
        No family data. <a href="/" style={{ color: 'hsl(var(--primary))', marginInlineStart: 6 }}>Import a .mftpkg</a> first.
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={header}>
        <input
          value={book.title}
          onChange={(e) => setBook({ ...book, title: e.target.value })}
          style={{ ...input, minWidth: 220, fontSize: 14, fontWeight: 600 }}
        />
        <button onClick={onSave} style={input}>Save</button>
        <select value="" onChange={(e) => e.target.value && onLoad(e.target.value)} style={{ ...input, minWidth: 140 }}>
          <option value="">Load saved…</option>
          {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        {savedBooks.length > 0 && (
          <select value="" onChange={(e) => e.target.value && onDelete(e.target.value)} style={{ ...input, width: 70 }}>
            <option value="">Del…</option>
            {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        )}
        <span style={{ marginInlineStart: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
          Export:
        </span>
        {EXPORT_FORMATS.map((f) => (
          <button key={f.id} onClick={() => onExport(f.id)} style={input}>{f.label}</button>
        ))}
        <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, marginInlineStart: 8 }}>
          Publish:
        </span>
        <button onClick={onWebHTML} disabled={busy} style={input}>Web HTML</button>
        <button onClick={onPDF} disabled={busy} style={input}>PDF Preview</button>
        <button onClick={onBundle} disabled={busy} style={input}>Website/book bundle</button>
        {busy && controllerRef.current && <button onClick={() => controllerRef.current?.abort()} style={input}>Cancel</button>}
      </header>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid hsl(var(--border))',
          background: validation.errors.length > 0 ? 'hsl(var(--destructive) / 0.08)' : 'hsl(var(--secondary))',
          fontSize: 12,
          color: validation.errors.length > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))',
        }}>
          <strong>
            {validation.errors.length > 0
              ? `${validation.errors.length} error${validation.errors.length === 1 ? '' : 's'}`
              : `${validation.warnings.length} warning${validation.warnings.length === 1 ? '' : 's'}`}
          </strong>
          {': '}
          {(validation.errors.length > 0 ? validation.errors : validation.warnings).slice(0, 3).map((v) => v.message).join(' · ')}
          {(validation.errors.length + validation.warnings.length) > 3 && ' …'}
        </div>
      )}

      <div style={body}>
        <aside style={leftPane}>
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600, padding: '12px 14px 8px', letterSpacing: 0.4 }}>SECTIONS</div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
            {book.sections.map((s, i) => (
              <SectionEditor
                key={i}
                section={s}
                index={i}
                total={book.sections.length}
                persons={persons}
                groups={groups}
                sources={sources}
                onChange={(next) => updateSection(i, next)}
                onRemove={() => removeSection(i)}
                onMoveUp={() => moveSection(i, -1)}
                onMoveDown={() => moveSection(i, 1)}
              />
            ))}
          </div>
          <div style={{ padding: 14, borderTop: '1px solid hsl(var(--border))' }}>
            <select
              value=""
              onChange={(e) => { if (e.target.value) { addSection(e.target.value); e.target.value = ''; } }}
              style={{ ...input, width: '100%' }}
            >
              <option value="">+ Add section…</option>
              {SECTION_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
        </aside>
        <main style={main}>
          {(status || progress) && (
            <div style={statusBar}>
              <span>{progress?.message || status}</span>
              {progress?.total ? <span>{Math.round((progress.completed / progress.total) * 100)}%</span> : null}
            </div>
          )}
          <ReportPreview report={compiled} />
        </main>
      </div>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--background))' };
const header = { display: 'flex', gap: 6, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', flexWrap: 'wrap' };
const body = { flex: 1, display: 'flex', overflow: 'hidden' };
const leftPane = { width: 360, display: 'flex', flexDirection: 'column', borderInlineEnd: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const main = { flex: 1, overflow: 'auto' };
const input = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none', cursor: 'pointer' };
const statusBar = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 14px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', fontSize: 12 };
const loadingStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--background))' };

export default BooksApp;
