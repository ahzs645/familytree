/**
 * ChartsApp — top-level UI for the charts page.
 * Picks a person, chooses chart type and theme, renders the chart.
 * Supports a second-person picker for Double Ancestor and Relationship Path.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { listAllPersons, findStartPerson, buildAncestorTree, buildDescendantTree } from '../../lib/treeQuery.js';
import { findRelationshipPath } from '../../lib/relationshipPath.js';
import { listChartTemplates, saveChartTemplate, deleteChartTemplate, newTemplateId } from '../../lib/chartTemplates.js';
import { THEMES, getTheme } from './theme.js';
import { PersonPicker } from './PersonPicker.jsx';
import { AncestorChart } from './AncestorChart.jsx';
import { DescendantChart } from './DescendantChart.jsx';
import { HourglassChart } from './HourglassChart.jsx';
import { TreeChart } from './TreeChart.jsx';
import { DoubleAncestorChart } from './DoubleAncestorChart.jsx';
import { FanChart } from './FanChart.jsx';
import { RelationshipPathChart } from './RelationshipPathChart.jsx';

const CHART_TYPES = [
  { id: 'ancestor', label: 'Ancestor', needsSecond: false },
  { id: 'descendant', label: 'Descendant', needsSecond: false },
  { id: 'hourglass', label: 'Hourglass', needsSecond: false },
  { id: 'tree', label: 'Tree (horizontal)', needsSecond: false },
  { id: 'double-ancestor', label: 'Double Ancestor', needsSecond: true },
  { id: 'fan', label: 'Fan', needsSecond: false },
  { id: 'relationship', label: 'Relationship Path', needsSecond: true },
];

export function ChartsApp() {
  const [persons, setPersons] = useState([]);
  const [rootId, setRootId] = useState(null);
  const [secondId, setSecondId] = useState(null);
  const [chartType, setChartType] = useState('ancestor');
  const [generations, setGenerations] = useState(5);
  const [themeId, setThemeId] = useState(THEMES[0].id);
  const [ancestorTree, setAncestorTree] = useState(null);
  const [descendantTree, setDescendantTree] = useState(null);
  const [secondAncestorTree, setSecondAncestorTree] = useState(null);
  const [relationshipResult, setRelationshipResult] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  const theme = getTheme(themeId);
  const needsSecond = CHART_TYPES.find((t) => t.id === chartType)?.needsSecond;

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      setTemplates(await listChartTemplates());
      if (list.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      const start = await findStartPerson();
      setRootId(start?.recordName || list[0].recordName);
      setLoading(false);
    })();
  }, []);

  // Build trees as inputs change.
  useEffect(() => {
    if (!rootId) return;
    let cancelled = false;
    (async () => {
      const a = await buildAncestorTree(rootId, generations);
      const d = await buildDescendantTree(rootId, Math.min(generations, 4));
      if (!cancelled) {
        setAncestorTree(a);
        setDescendantTree(d);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootId, generations]);

  useEffect(() => {
    if (!secondId || !needsSecond) {
      setSecondAncestorTree(null);
      setRelationshipResult(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (chartType === 'double-ancestor') {
        const a2 = await buildAncestorTree(secondId, generations);
        if (!cancelled) setSecondAncestorTree(a2);
      } else if (chartType === 'relationship') {
        const r = await findRelationshipPath(rootId, secondId);
        if (!cancelled) setRelationshipResult(r);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [secondId, chartType, generations, needsSecond, rootId]);

  const onPersonClick = useCallback((p) => setRootId(p.recordName), []);

  const onSaveTemplate = useCallback(async () => {
    const name = prompt('Name for this chart template:');
    if (!name) return;
    const tpl = {
      id: newTemplateId(),
      name,
      chartType,
      themeId,
      generations,
    };
    await saveChartTemplate(tpl);
    setTemplates(await listChartTemplates());
  }, [chartType, themeId, generations]);

  const onApplyTemplate = useCallback(async (id) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setChartType(tpl.chartType);
    setThemeId(tpl.themeId);
    setGenerations(tpl.generations);
  }, [templates]);

  const onDeleteTemplate = useCallback(async (id) => {
    if (!confirm('Delete this template?')) return;
    await deleteChartTemplate(id);
    setTemplates(await listChartTemplates());
  }, []);

  if (loading) return <div style={loadingStyle}>Loading family data…</div>;
  if (empty) {
    return (
      <div style={loadingStyle}>
        No family data found. <a href="/" style={{ color: '#6c8aff', marginLeft: 6 }}>Import a .mftpkg</a> first.
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <a href="/" style={{ color: '#8b90a0', textDecoration: 'none', marginRight: 16, fontSize: 13 }}>← Home</a>
        <strong style={{ color: '#e2e4eb', marginRight: 24 }}>Charts</strong>

        <Field label="Person">
          <PersonPicker persons={persons} value={rootId} onChange={setRootId} />
        </Field>

        {needsSecond && (
          <Field label={chartType === 'relationship' ? 'Compare to' : 'Partner'}>
            <PersonPicker persons={persons} value={secondId} onChange={setSecondId} />
          </Field>
        )}

        <Field label="Type">
          <select value={chartType} onChange={(e) => setChartType(e.target.value)} style={selectStyle}>
            {CHART_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Theme">
          <select value={themeId} onChange={(e) => setThemeId(e.target.value)} style={selectStyle}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Generations">
          <input
            type="number"
            min={2}
            max={8}
            value={generations}
            onChange={(e) => setGenerations(Math.min(8, Math.max(2, +e.target.value || 5)))}
            style={{ ...selectStyle, width: 64 }}
          />
        </Field>

        <Field label="Templates">
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value=""
              onChange={(e) => e.target.value && onApplyTemplate(e.target.value)}
              style={{ ...selectStyle, minWidth: 140 }}
            >
              <option value="">Load saved…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button onClick={onSaveTemplate} style={selectStyle}>Save</button>
            {templates.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && onDeleteTemplate(e.target.value)}
                style={{ ...selectStyle, width: 60 }}
                title="Delete a saved template"
              >
                <option value="">Del…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        </Field>

        <span style={{ marginLeft: 'auto', color: theme.textMuted, fontSize: 12 }}>
          Drag · scroll · click a node to re-root
        </span>
      </header>

      <main style={mainStyle}>
        {chartType === 'ancestor' && (
          <AncestorChart tree={ancestorTree} generations={generations} onPersonClick={onPersonClick} theme={theme} />
        )}
        {chartType === 'descendant' && (
          <DescendantChart tree={descendantTree} onPersonClick={onPersonClick} theme={theme} />
        )}
        {chartType === 'hourglass' && (
          <HourglassChart
            ancestorTree={ancestorTree}
            descendantTree={descendantTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
          />
        )}
        {chartType === 'tree' && (
          <TreeChart
            ancestorTree={ancestorTree}
            descendantTree={descendantTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
          />
        )}
        {chartType === 'double-ancestor' && (
          <DoubleAncestorChart
            leftTree={ancestorTree}
            rightTree={secondAncestorTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
          />
        )}
        {chartType === 'fan' && (
          <FanChart tree={ancestorTree} generations={generations} onPersonClick={onPersonClick} theme={theme} />
        )}
        {chartType === 'relationship' && (
          <RelationshipPathChart result={relationshipResult} onPersonClick={onPersonClick} theme={theme} />
        )}
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12 }}>
      <span style={{ color: '#8b90a0', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

const shellStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: '#0f1117',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
};
const headerStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderBottom: '1px solid #2e3345',
  background: '#161926',
  flexWrap: 'wrap',
};
const mainStyle = { flex: 1, position: 'relative', overflow: 'hidden' };
const selectStyle = {
  background: '#242837',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 8,
  padding: '8px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  cursor: 'pointer',
};
const loadingStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  color: '#8b90a0',
  background: '#0f1117',
  fontFamily: '-apple-system, system-ui, sans-serif',
};

export default ChartsApp;
