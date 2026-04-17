/**
 * Dual-pane interactive tree navigator: persons list on the left, focus view on the right.
 * Uses ActivePersonContext so the choice persists across routes.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAllPersons, findStartPerson } from '../../lib/treeQuery.js';
import { buildPersonContext } from '../../lib/personContext.js';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { PersonList } from './PersonList.jsx';
import { PersonFocus } from './PersonFocus.jsx';

export function InteractiveTreeApp() {
  const [persons, setPersons] = useState([]);
  const [context, setContext] = useState(null);
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
      const ctx = await buildPersonContext(activeId);
      if (!cancelled) setContext(ctx);
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
        <a href="/" style={{ color: '#6c8aff', marginLeft: 6 }}>Import a .mftpkg</a> first.
      </EmptyMsg>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: 280, flexShrink: 0 }}>
        <PersonList persons={persons} activeId={activeId} onPick={onPick} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PersonFocus
          context={context}
          onPick={onPick}
          onOpenAncestorChart={openAncestor}
          onOpenDescendantChart={openDescendant}
        />
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
  color: '#8b90a0',
  fontSize: 14,
};

export default InteractiveTreeApp;
