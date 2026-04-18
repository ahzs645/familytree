/**
 * Dual-pane interactive tree navigator: persons list on the left, focus view on the right.
 * Uses ActivePersonContext so the choice persists across routes.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAllPersons, findStartPerson, buildAncestorTree, buildDescendantTree } from '../../lib/treeQuery.js';
import { buildPersonContext } from '../../lib/personContext.js';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { PersonList } from './PersonList.jsx';
import { PersonFocus } from './PersonFocus.jsx';
import { ThreeDTreeView } from './ThreeDTreeView.jsx';

export function InteractiveTreeApp() {
  const [persons, setPersons] = useState([]);
  const [context, setContext] = useState(null);
  const [trees, setTrees] = useState({ ancestor: null, descendant: null, loading: false });
  const [viewMode, setViewMode] = useState('three');
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const { recordName: activeId, setActivePerson } = useActivePerson();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      if (list.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      if (!activeId || !list.some((p) => p.recordName === activeId)) {
        const start = await findStartPerson();
        setActivePerson(start?.recordName || list[0].recordName);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      setTrees((current) => ({ ...current, loading: true }));
      const [ctx, ancestor, descendant] = await Promise.all([
        buildPersonContext(activeId),
        buildAncestorTree(activeId, 4),
        buildDescendantTree(activeId, 4),
      ]);
      if (!cancelled) {
        setContext(ctx);
        setTrees({ ancestor, descendant, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const onPick = useCallback((recordName) => setActivePerson(recordName), [setActivePerson]);
  const openAncestor = useCallback(
    (recordName) => {
      setActivePerson(recordName);
      navigate('/charts?type=ancestor');
    },
    [navigate, setActivePerson]
  );
  const openDescendant = useCallback(
    (recordName) => {
      setActivePerson(recordName);
      navigate('/charts?type=descendant');
    },
    [navigate, setActivePerson]
  );

  if (loading) return <EmptyMsg text="Loading…" />;
  if (empty) {
    return (
      <EmptyMsg>
        No family data found.{' '}
        <a href="/" style={{ color: 'hsl(var(--primary))', marginLeft: 6 }}>Import a .mftpkg</a> first.
      </EmptyMsg>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: 'min(280px, 46vw)', flexShrink: 0 }}>
        <PersonList persons={persons} activeId={activeId} onPick={onPick} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={toolbar}>
          <div style={{ minWidth: 0 }}>
            <div style={eyebrow}>Interactive Tree</div>
            <div style={title} title={context?.selfSummary?.fullName || ''}>
              {context?.selfSummary?.fullName || 'No person selected'}
            </div>
          </div>
          <div style={segmented} role="tablist" aria-label="Tree view mode">
            <button
              type="button"
              onClick={() => setViewMode('three')}
              style={segment(viewMode === 'three')}
              aria-selected={viewMode === 'three'}
            >
              3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('details')}
              style={segment(viewMode === 'details')}
              aria-selected={viewMode === 'details'}
            >
              Details
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {viewMode === 'three' ? (
            <ThreeDTreeView
              ancestorTree={trees.ancestor}
              descendantTree={trees.descendant}
              activeId={activeId}
              loading={trees.loading}
              onPick={onPick}
            />
          ) : (
            <PersonFocus
              context={context}
              onPick={onPick}
              onOpenAncestorChart={openAncestor}
              onOpenDescendantChart={openDescendant}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyMsg({ text, children }) {
  return (
    <div style={empty}>
      {text}
      {children}
    </div>
  );
}

const empty = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'hsl(var(--muted-foreground))',
  fontSize: 14,
};

const toolbar = {
  height: 64,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '10px 16px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
};
const eyebrow = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 3,
};
const title = {
  color: 'hsl(var(--foreground))',
  fontSize: 17,
  fontWeight: 750,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const segmented = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--secondary))',
};
function segment(active) {
  return {
    border: '1px solid transparent',
    borderRadius: 6,
    background: active ? 'hsl(var(--background))' : 'transparent',
    color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
    boxShadow: active ? '0 1px 6px rgb(0 0 0 / 0.08)' : 'none',
    padding: '6px 10px',
    minWidth: 62,
    font: '700 12px -apple-system, system-ui, sans-serif',
    cursor: 'pointer',
  };
}

export default InteractiveTreeApp;
