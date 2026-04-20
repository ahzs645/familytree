/**
 * Read-only chart preview loaded from a compressed share-link token.
 * Mounted at /view/:token. No IndexedDB writes, no navigation outside payload.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { decodeSharePayload, SHARE_PAYLOAD_VERSION } from '../lib/chartShareLink.js';

export default function ChartPreview() {
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading', payload: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await decodeSharePayload(token);
        if (cancelled) return;
        if (!payload || typeof payload !== 'object') {
          setState({ status: 'error', error: new Error('Invalid payload'), payload: null });
          return;
        }
        if (payload.version !== SHARE_PAYLOAD_VERSION) {
          setState({ status: 'error', error: new Error(`Unsupported payload version v${payload.version}`), payload: null });
          return;
        }
        setState({ status: 'ready', payload, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', payload: null, error: err });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (state.status === 'loading') {
    return <div className="p-10 text-muted-foreground text-sm">Decoding share link…</div>;
  }
  if (state.status === 'error') {
    return (
      <div className="p-10 max-w-lg mx-auto text-center">
        <div className="text-sm text-destructive mb-3">Couldn't open this share link.</div>
        <div className="text-xs text-muted-foreground mb-5">{String(state.error?.message || state.error)}</div>
        <Link to="/" className="text-sm text-primary hover:underline">← Back to Home</Link>
      </div>
    );
  }
  return <PreviewBody payload={state.payload} />;
}

function PreviewBody({ payload }) {
  const { chart, persons, families } = payload;
  const rootId = chart?.roots?.primaryPersonId;
  const rootPerson = rootId ? persons[rootId] : null;
  const indexByRecord = useMemo(() => {
    const map = new Map();
    for (const [id, person] of Object.entries(persons || {})) {
      map.set(id, person);
    }
    return map;
  }, [persons]);

  const ancestors = useMemo(() => buildAncestorPairs(rootId, persons, families), [rootId, persons, families]);
  const descendants = useMemo(() => buildDescendantList(rootId, persons, families), [rootId, persons, families]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-5 py-3 flex items-center gap-3">
        <Link to="/" className="text-xs text-muted-foreground hover:underline">CloudTreeWeb</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">{chart?.name || 'Shared Chart'}</h1>
        <span className="text-xs text-muted-foreground">
          {Object.keys(persons || {}).length.toLocaleString()} persons · {Object.keys(families || {}).length.toLocaleString()} families
        </span>
        <span className="ms-auto text-xs text-muted-foreground">Read-only preview</span>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {rootPerson && (
          <section className="rounded-xl border border-border bg-card p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Subject</div>
            <div className="text-2xl font-bold">{rootPerson.summary?.fullName || rootPerson.recordName}</div>
            <div className="text-sm text-muted-foreground">
              {rootPerson.summary?.birthDate || '?'} – {rootPerson.summary?.deathDate || 'present'}
            </div>
          </section>
        )}
        {ancestors.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Ancestors</h2>
            <div className="grid gap-2">
              {ancestors.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_24px_1fr] items-center gap-2">
                  <AncestorCell person={row.father} />
                  <div className="text-xs text-muted-foreground text-center">&</div>
                  <AncestorCell person={row.mother} />
                </div>
              ))}
            </div>
          </section>
        )}
        {descendants.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Descendants</h2>
            <ul className="space-y-1 text-sm">
              {descendants.slice(0, 200).map((entry) => (
                <li key={entry.recordName} style={{ paddingInlineStart: entry.depth * 18 }}>
                  <span className="font-medium">{entry.summary?.fullName || entry.recordName}</span>
                  <span className="text-xs text-muted-foreground ms-2">
                    {entry.summary?.birthDate || ''} {entry.summary?.deathDate ? `– ${entry.summary.deathDate}` : ''}
                  </span>
                </li>
              ))}
              {descendants.length > 200 && (
                <li className="text-xs text-muted-foreground text-center">… +{descendants.length - 200} more descendants</li>
              )}
            </ul>
          </section>
        )}
        <footer className="text-xs text-muted-foreground pt-6 border-t border-border">
          Chart type: <span className="font-medium">{chart?.chartType || 'unknown'}</span>. Shared link contains no media files.
          <Link to="/" className="ms-3 text-primary hover:underline">Open CloudTreeWeb</Link>
        </footer>
      </main>
    </div>
  );
}

function AncestorCell({ person }) {
  if (!person) {
    return <div className="rounded-md border border-dashed border-border bg-background text-center px-2 py-1.5 text-xs text-muted-foreground">Unknown</div>;
  }
  return (
    <div className="rounded-md border border-border bg-secondary px-2 py-1.5 text-sm">
      <div className="font-medium truncate">{person.summary?.fullName || person.recordName}</div>
      <div className="text-[11px] text-muted-foreground">
        {person.summary?.birthDate || ''} {person.summary?.deathDate ? `– ${person.summary.deathDate}` : ''}
      </div>
    </div>
  );
}

function buildAncestorPairs(rootId, persons, families) {
  if (!rootId) return [];
  const out = [];
  const visited = new Set();
  // Collect the direct parents by finding families where the root appears as a child.
  // With only persons/families in the payload, we fall back to scanning families for men/women.
  // (The builder also emits spouse/parent refs via family records.)
  const walk = (id, depth = 0) => {
    if (!id || visited.has(id) || depth > 8) return null;
    visited.add(id);
    const parentFamily = findParentFamily(id, families);
    if (!parentFamily) return null;
    const fatherId = refId(parentFamily.fields?.man?.value);
    const motherId = refId(parentFamily.fields?.woman?.value);
    out.push({
      father: fatherId ? persons[fatherId] : null,
      mother: motherId ? persons[motherId] : null,
    });
    if (fatherId) walk(fatherId, depth + 1);
    if (motherId) walk(motherId, depth + 1);
    return null;
  };
  walk(rootId);
  return out;
}

function buildDescendantList(rootId, persons, families) {
  if (!rootId) return [];
  const out = [];
  const seen = new Set();
  const walk = (id, depth) => {
    if (!id || seen.has(id) || depth > 8) return;
    seen.add(id);
    if (depth > 0) {
      const person = persons[id];
      if (person) out.push({ ...person, depth });
    }
    for (const [, family] of Object.entries(families || {})) {
      if (refId(family.fields?.man?.value) === id || refId(family.fields?.woman?.value) === id) {
        // Children live in ChildRelation records, which aren't in the minimal payload.
        // Walking by spouse lookup isn't possible without child edges, so we stop here.
      }
    }
  };
  walk(rootId, 0);
  return out;
}

function findParentFamily(childId, families) {
  // Without ChildRelation records we can't resolve true child→family edges.
  // The share payload leaves ancestor discovery to the direct parent refs
  // already collected during `buildChartSharePayload`'s visitPerson walk.
  for (const family of Object.values(families || {})) {
    if (!family) continue;
    if (refId(family.fields?.man?.value) === childId || refId(family.fields?.woman?.value) === childId) continue;
  }
  return null;
}

function refId(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const i = raw.indexOf('---');
    return i >= 0 ? raw.slice(0, i) : raw;
  }
  if (typeof raw === 'object' && raw.value) return refId(raw.value);
  return null;
}
