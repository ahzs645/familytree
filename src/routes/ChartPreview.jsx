/**
 * Read-only chart preview loaded from a compressed share-link token.
 * Mounted at /view/:token. No IndexedDB writes, no navigation outside payload.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { decodeSharePayload, SHARE_PAYLOAD_VERSION } from '../lib/chartShareLink.js';
import { getTheme } from '../components/charts/theme.js';
import { AncestorChart } from '../components/charts/AncestorChart.jsx';
import { DescendantChart } from '../components/charts/DescendantChart.jsx';
import { HourglassChart } from '../components/charts/HourglassChart.jsx';
import { TreeChart } from '../components/charts/TreeChart.jsx';
import { DoubleAncestorChart } from '../components/charts/DoubleAncestorChart.jsx';
import { FanChart } from '../components/charts/FanChart.jsx';
import {
  CircularAncestorChart,
  FractalAncestorChart,
} from '../components/charts/SpecializedCharts.jsx';

export default function ChartPreview(props) {
  return <ChartPreviewContent {...props} />;
}

export function ChartPreviewContent({ token: tokenOverride }) {
  const { token: routeToken } = useParams();
  const token = tokenOverride || routeToken;
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
  const { chart, trees } = payload;
  const persons = payload.persons || {};
  const families = payload.families || {};
  const rootId = chart?.roots?.primaryPersonId;
  const rootPerson = payload.rootPerson || (rootId ? persons[rootId] : null);
  const personCount = payload.counts?.persons ?? Object.keys(persons).length;
  const familyCount = payload.counts?.families ?? Object.keys(families).length;
  const hasRenderableTree = Boolean(trees?.ancestorTree || trees?.descendantTree);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="shrink-0 border-b border-border bg-card px-5 py-3 flex items-center gap-3">
        <Link to="/" className="text-xs text-muted-foreground hover:underline">CloudTreeWeb</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">{chart?.name || 'Shared Chart'}</h1>
        <span className="text-xs text-muted-foreground">
          {personCount.toLocaleString()} persons · {familyCount.toLocaleString()} families
        </span>
        <span className="ms-auto text-xs text-muted-foreground">Read-only preview</span>
      </header>
      <main className="flex-1 min-h-0">
        {hasRenderableTree ? (
          <PreviewChart payload={payload} />
        ) : (
          <LegacyPreview chart={chart} rootPerson={rootPerson} />
        )}
      </main>
    </div>
  );
}

function PreviewChart({ payload }) {
  const { chart, trees } = payload;
  const chartType = chart?.chartType || 'ancestor';
  const theme = useMemo(() => getTheme(chart?.compositorConfig?.themeId || 'auto'), [chart?.compositorConfig?.themeId]);
  const generations = Number(chart?.builderConfig?.common?.generations) || 5;
  const page = useMemo(() => {
    const setup = chart?.pageSetup || {};
    return {
      title: setup.title || '',
      note: setup.note || '',
      paperSize: setup.paperSize || setup.size || 'letter',
      orientation: setup.orientation || 'landscape',
      backgroundColor: setup.backgroundColor || theme.background,
      margins: setup.margins,
      printMargins: setup.printMargins,
      overlap: setup.overlap || 0,
      cutMarks: Boolean(setup.cutMarks),
      printPageNumbers: Boolean(setup.printPageNumbers),
      omitEmptyPages: setup.omitEmptyPages !== false,
    };
  }, [chart?.pageSetup, theme]);
  const overlays = Array.isArray(chart?.compositorConfig?.overlays) ? chart.compositorConfig.overlays : [];

  const common = { theme, page, overlays };

  if (chartType === 'descendant') {
    return <DescendantChart tree={trees.descendantTree} {...common} />;
  }
  if (chartType === 'hourglass') {
    return <HourglassChart ancestorTree={trees.ancestorTree} descendantTree={trees.descendantTree} generations={generations} {...common} />;
  }
  if (chartType === 'tree' || chartType === 'symmetrical') {
    return <TreeChart ancestorTree={trees.ancestorTree} descendantTree={trees.descendantTree} generations={generations} variant={chartType === 'symmetrical' ? 'symmetrical' : 'horizontal'} {...common} />;
  }
  if (chartType === 'double-ancestor') {
    return <DoubleAncestorChart leftTree={trees.ancestorTree} rightTree={trees.secondAncestorTree} leftGenerations={generations} rightGenerations={generations} {...common} />;
  }
  if (chartType === 'fan') {
    return <FanChart tree={trees.ancestorTree} generations={generations} {...common} />;
  }
  if (chartType === 'circular') {
    return <CircularAncestorChart tree={trees.ancestorTree} generations={generations} {...common} />;
  }
  if (chartType === 'fractal-h-tree') {
    return <FractalAncestorChart tree={trees.ancestorTree} generations={generations} variant="h-tree" {...common} />;
  }
  if (chartType === 'square-tree') {
    return <FractalAncestorChart tree={trees.ancestorTree} generations={generations} variant="square" {...common} />;
  }
  if (chartType === 'fractal-tree') {
    return <FractalAncestorChart tree={trees.ancestorTree} generations={generations} variant="fractal" {...common} />;
  }
  return <AncestorChart tree={trees.ancestorTree} generations={generations} {...common} />;
}

function LegacyPreview({ rootPerson }) {
  const summary = rootPerson?.summary || rootPerson;
  return (
    <div className="max-w-4xl mx-auto p-6">
      {rootPerson ? (
        <section className="rounded-xl border border-border bg-card p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Subject</div>
          <div className="text-2xl font-bold">{summary?.fullName || rootPerson.recordName}</div>
          <div className="text-sm text-muted-foreground">
            {summary?.birthDate || '?'} – {summary?.deathDate || 'present'}
          </div>
        </section>
      ) : null}
    </div>
  );
}
