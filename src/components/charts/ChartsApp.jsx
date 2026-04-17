/**
 * ChartsApp — top-level UI for the charts page.
 * Picks a person, chooses chart type and theme, renders the chart.
 * Supports a second-person picker for Double Ancestor and Relationship Path.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listAllPersons, findStartPerson, buildAncestorTree, buildDescendantTree } from '../../lib/treeQuery.js';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
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
import { VirtualTreeDiagram } from './VirtualTreeDiagram.jsx';

const CHART_TYPES = [
  { id: 'ancestor', label: 'Ancestor', needsSecond: false },
  { id: 'descendant', label: 'Descendant', needsSecond: false },
  { id: 'hourglass', label: 'Hourglass', needsSecond: false },
  { id: 'tree', label: 'Tree (horizontal)', needsSecond: false },
  { id: 'double-ancestor', label: 'Double Ancestor', needsSecond: true },
  { id: 'fan', label: 'Fan', needsSecond: false },
  { id: 'relationship', label: 'Relationship Path', needsSecond: true },
  { id: 'virtual', label: 'Virtual Tree (configurable)', needsSecond: false },
];

export function ChartsApp() {
  const [searchParams] = useSearchParams();
  const { recordName: sharedRootId, setActivePerson } = useActivePerson();
  const [persons, setPersons] = useState([]);
  const [rootId, setRootId] = useState(sharedRootId);
  const [secondId, setSecondId] = useState(null);
  const [chartType, setChartType] = useState(searchParams.get('type') || 'ancestor');
  const [generations, setGenerations] = useState(5);
  const [themeId, setThemeId] = useState('auto');
  const { theme: appTheme } = useTheme();
  const [virtualSource, setVirtualSource] = useState('descendant');
  const [virtualOrientation, setVirtualOrientation] = useState('vertical');
  const [virtualHSpacing, setVirtualHSpacing] = useState(24);
  const [virtualVSpacing, setVirtualVSpacing] = useState(110);
  const [ancestorTree, setAncestorTree] = useState(null);
  const [descendantTree, setDescendantTree] = useState(null);
  const [secondAncestorTree, setSecondAncestorTree] = useState(null);
  const [relationshipResult, setRelationshipResult] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  const theme = getTheme(themeId, appTheme === 'dark');
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
      if (!rootId || !list.some((p) => p.recordName === rootId)) {
        const start = await findStartPerson();
        const pick = start?.recordName || list[0].recordName;
        setRootId(pick);
        setActivePerson(pick);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onPersonClick = useCallback(
    (p) => {
      setRootId(p.recordName);
      setActivePerson(p.recordName);
    },
    [setActivePerson]
  );
  const onRootChange = useCallback(
    (id) => {
      setRootId(id);
      setActivePerson(id);
    },
    [setActivePerson]
  );

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
        No family data found. <a href="/" style={{ color: 'hsl(var(--primary))', marginLeft: 6 }}>Import a .mftpkg</a> first.
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <Field label="Person">
          <PersonPicker persons={persons} value={rootId} onChange={onRootChange} />
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
          <RelationshipPathChart result={relationshipResult} secondPicked={!!secondId} onPersonClick={onPersonClick} theme={theme} />
        )}
        {chartType === 'virtual' && (
          <div style={{ display: 'flex', height: '100%' }}>
            <aside style={{ width: 220, padding: 16, borderRight: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: 13 }}>
              <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 8, letterSpacing: 0.4 }}>VIRTUAL TREE OPTIONS</div>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Source</div>
                <select value={virtualSource} onChange={(e) => setVirtualSource(e.target.value)} style={optionSelect}>
                  <option value="descendant">Descendants</option>
                  <option value="ancestor">Ancestors</option>
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Orientation</div>
                <select value={virtualOrientation} onChange={(e) => setVirtualOrientation(e.target.value)} style={optionSelect}>
                  <option value="vertical">Vertical</option>
                  <option value="horizontal">Horizontal</option>
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Sibling spacing ({virtualHSpacing}px)</div>
                <input type="range" min={8} max={80} value={virtualHSpacing} onChange={(e) => setVirtualHSpacing(+e.target.value)} style={{ width: '100%' }} />
              </label>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Generation spacing ({virtualVSpacing}px)</div>
                <input type="range" min={50} max={200} value={virtualVSpacing} onChange={(e) => setVirtualVSpacing(+e.target.value)} style={{ width: '100%' }} />
              </label>
            </aside>
            <div style={{ flex: 1, position: 'relative' }}>
              <VirtualTreeDiagram
                tree={virtualSource === 'ancestor' ? ancestorTree : descendantTree}
                source={virtualSource}
                onPersonClick={onPersonClick}
                theme={theme}
                options={{ orientation: virtualOrientation, hSpacing: virtualHSpacing, vSpacing: virtualVSpacing }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12 }}>
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

const shellStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'hsl(var(--background))',
};
const headerStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  flexWrap: 'wrap',
};
const mainStyle = { flex: 1, position: 'relative', overflow: 'hidden' };
const selectStyle = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  padding: '8px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  cursor: 'pointer',
};
const optionSelect = {
  width: '100%',
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 8px',
  font: '12px -apple-system, system-ui, sans-serif',
  outline: 'none',
};
const loadingStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'hsl(var(--muted-foreground))',
  background: 'hsl(var(--background))',
};

export default ChartsApp;
