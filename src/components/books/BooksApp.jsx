/**
 * BooksApp — compose a multi-section book, preview compiled output, save/load,
 * and export using the same report exporters.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { listAllPersons } from '../../lib/treeQuery.js';
import { SECTION_KINDS, listBooks, saveBook, deleteBook, compileBook, newBookId } from '../../lib/books.js';
import { EXPORT_FORMATS, downloadReport } from '../../lib/reports/export.js';
import { SectionEditor } from './SectionEditor.jsx';
import { ReportPreview } from '../reports/ReportPreview.jsx';

function blankBook() {
  return {
    id: null,
    title: 'My Family Book',
    sections: [
      { kind: 'title', text: 'My Family Book', subtitle: '' },
      { kind: 'toc' },
    ],
  };
}

export function BooksApp() {
  const [persons, setPersons] = useState([]);
  const [book, setBook] = useState(blankBook());
  const [compiled, setCompiled] = useState(null);
  const [savedBooks, setSavedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      setSavedBooks(await listBooks());
      setLoading(false);
      if (list.length === 0) setEmpty(true);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await compileBook(book);
      if (!cancelled) setCompiled(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [book]);

  const updateSection = useCallback((i, next) => {
    setBook((b) => ({ ...b, sections: b.sections.map((s, j) => (j === i ? next : s)) }));
  }, []);

  const addSection = useCallback((kind) => {
    const def = SECTION_KINDS.find((k) => k.id === kind);
    const section = { kind };
    if (def?.needsPerson) section.targetRecordName = persons[0]?.recordName;
    if (def?.needsGenerations) section.generations = 5;
    if (kind === 'title') section.text = 'New Section';
    setBook((b) => ({ ...b, sections: [...b.sections, section] }));
  }, [persons]);

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
    downloadReport(fmt, compiled, { filenameBase: book.title });
  }, [compiled, book.title]);

  if (loading) return <div style={loadingStyle}>Loading…</div>;
  if (empty) {
    return (
      <div style={loadingStyle}>
        No family data. <a href="/" style={{ color: '#6c8aff', marginLeft: 6 }}>Import a .mftpkg</a> first.
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
        <span style={{ marginLeft: 'auto', color: '#8b90a0', fontSize: 12 }}>
          Export:
        </span>
        {EXPORT_FORMATS.map((f) => (
          <button key={f.id} onClick={() => onExport(f.id)} style={input}>{f.label}</button>
        ))}
      </header>

      <div style={body}>
        <aside style={leftPane}>
          <div style={{ color: '#8b90a0', fontSize: 11, fontWeight: 600, padding: '12px 14px 8px', letterSpacing: 0.4 }}>SECTIONS</div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
            {book.sections.map((s, i) => (
              <SectionEditor
                key={i}
                section={s}
                index={i}
                total={book.sections.length}
                persons={persons}
                onChange={(next) => updateSection(i, next)}
                onRemove={() => removeSection(i)}
                onMoveUp={() => moveSection(i, -1)}
                onMoveDown={() => moveSection(i, 1)}
              />
            ))}
          </div>
          <div style={{ padding: 14, borderTop: '1px solid #2e3345' }}>
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
          <ReportPreview report={compiled} />
        </main>
      </div>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1117' };
const header = { display: 'flex', gap: 6, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #2e3345', background: '#161926', flexWrap: 'wrap' };
const body = { flex: 1, display: 'flex', overflow: 'hidden' };
const leftPane = { width: 360, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2e3345', background: '#13161f' };
const main = { flex: 1, overflow: 'auto' };
const input = { background: '#242837', color: '#e2e4eb', border: '1px solid #2e3345', borderRadius: 8, padding: '8px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none', cursor: 'pointer' };
const loadingStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8b90a0', background: '#0f1117' };

export default BooksApp;
