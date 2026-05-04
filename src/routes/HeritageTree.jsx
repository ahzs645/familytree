import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../components/heritageTree/heritageTree.css';
import { CW, loadHeritageTreeData, layoutHeritageTree } from '../components/heritageTree/appTreeAdapter.js';
import PersonCard from '../components/heritageTree/PersonCard.jsx';
import Legend from '../components/heritageTree/Legend.jsx';
import Header from '../components/heritageTree/Header.jsx';
import AnalyticsModal from '../components/heritageTree/AnalyticsModal.jsx';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';

export default function HeritageTree() {
  const [view, setView] = useState({ scale: 0.38, tx: 60, ty: 30 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRootId, setSelectedRootId] = useState(null);
  const [theme, setTheme] = useState('classic');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const { recordName: activeId, setActivePerson } = useActivePerson();

  const { nodes, connectors, maxGen, individuals, rootId, genBands, genLabels, indis, fams } = useMemo(
    () => treeData ? layoutHeritageTree(treeData, selectedRootId || activeId) : layoutHeritageTree(null),
    [treeData, selectedRootId, activeId]
  );
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const filteredIndividuals = useMemo(() => {
    if (!searchTerm) return individuals;
    const lower = searchTerm.toLowerCase();
    return individuals.filter((i) => i.name.toLowerCase().includes(lower));
  }, [individuals, searchTerm]);

  const highlightedIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const highlight = new Set([hoveredNodeId]);

    const upQueue = [hoveredNodeId];
    while (upQueue.length > 0) {
      const curr = indis[upQueue.shift()];
      if (curr?.famc?.length > 0) {
        const fam = fams[curr.famc[0]];
        if (fam?.husb) {
          highlight.add(fam.husb);
          upQueue.push(fam.husb);
        }
        if (fam?.wife) {
          highlight.add(fam.wife);
          upQueue.push(fam.wife);
        }
      }
    }

    const downQueue = [hoveredNodeId];
    while (downQueue.length > 0) {
      const curr = indis[downQueue.shift()];
      curr?.fams?.forEach((fId) => {
        const fam = fams[fId];
        if (!fam) return;
        if (fam.husb) highlight.add(fam.husb);
        if (fam.wife) highlight.add(fam.wife);
        fam.chil.forEach((cId) => {
          highlight.add(cId);
          downQueue.push(cId);
        });
      });
    }
    return highlight;
  }, [hoveredNodeId, indis, fams]);

  const handleResetView = () => {
    const rootNode = nodes.find((n) => n.id === rootId);
    if (rootNode) {
      const targetScale = 0.75;
      const tx = (window.innerWidth / 2) - (rootNode.x + CW / 2) * targetScale;
      const ty = (window.innerHeight / 2) - (rootNode.y + 45) * targetScale;
      setView({ scale: targetScale, tx, ty });
    } else {
      setView({ scale: 0.38, tx: 60, ty: 30 });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const next = await loadHeritageTreeData();
      if (!cancelled) {
        setTreeData(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    handleResetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, nodes.length]);

  const handleResetToDatasetDefault = () => {
    setSelectedRootId(null);
    if (selectedRootId === null) handleResetView();
  };
  const selectRoot = (recordName) => {
    setSelectedRootId(recordName);
    if (recordName) setActivePerson(recordName);
  };

  const handleHardReset = async () => {
    setLoading(true);
    const next = await loadHeritageTreeData();
    setTreeData(next);
    setSelectedRootId(null);
    setLoading(false);
  };

  const handleMouseDown = (e) => {
    dragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, startTx: view.tx, startTy: view.ty };
    setIsDragging(true);
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current.isDragging) return;
    setView((prev) => ({
      ...prev,
      tx: dragRef.current.startTx + (e.clientX - dragRef.current.startX),
      ty: dragRef.current.startTy + (e.clientY - dragRef.current.startY),
    }));
  };
  const handleMouseUp = () => {
    dragRef.current.isDragging = false;
    setIsDragging(false);
  };

  const maxX = nodes.length > 0 ? Math.max(...nodes.map((p) => p.x + CW)) + 140 : window.innerWidth;
  const maxY = nodes.length > 0 ? Math.max(...nodes.map((p) => p.y + p.h)) + 140 : window.innerHeight;

  if (loading) {
    return <div className="heritage-tree-loading">Loading heritage tree...</div>;
  }

  return (
    <div
      className="heritage-tree-view"
      data-heritage-theme={theme}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <Header
        maxGen={maxGen}
        rootName={byId[rootId]?.name}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredIndividuals={filteredIndividuals}
        rootId={rootId}
        setSelectedRootId={selectRoot}
        theme={theme}
        setTheme={setTheme}
        handleFileUpload={null}
        setShowAnalytics={setShowAnalytics}
        view={view}
        setView={setView}
        handleRecenter={handleResetView}
        handleResetToDatasetDefault={handleResetToDatasetDefault}
        handleHardReset={handleHardReset}
      />

      <div
        id="canvas"
        style={{
          width: maxX,
          height: maxY,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: isDragging ? 'none' : 'transform 0.4s ease-out',
        }}
      >
        <svg id="connectors" width={maxX} height={maxY} style={{ opacity: highlightedIds ? 0.35 : 1 }}>
          {connectors?.map((c) => (
            <polyline
              key={c.id}
              points={c.path}
              stroke={c.isMarriage ? 'var(--marriage-line)' : 'var(--blood-line)'}
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
              strokeDasharray={c.isMarriage ? '6,3' : 'none'}
              opacity={c.isMarriage ? '0.85' : '0.7'}
            />
          ))}
        </svg>

        {nodes.length === 0 && (
          <div className="heritage-empty-state">
            The layout engine could not calculate this person&apos;s family tree.
            <br />
            Please select another relative from the dropdown.
          </div>
        )}

        {nodes.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            isRoot={p.id === rootId}
            isDimmed={highlightedIds && !highlightedIds.has(p.id)}
            onMouseEnter={() => setHoveredNodeId(p.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => {
              selectRoot(p.id);
            }}
          />
        ))}

        {genBands?.map((b) => (
          <div key={`band-${b.id}`} className="gen-band" style={{ top: b.y }} />
        ))}
      </div>

      {genLabels?.map((l) => (
        <div key={`label-${l.gen}`} className="gen-label" style={{ top: (l.y * view.scale + view.ty + 62) }}>
          Generation {l.gen}
        </div>
      ))}

      <Legend nodes={nodes} />

      <AnalyticsModal show={showAnalytics} onClose={() => setShowAnalytics(false)} indis={indis} nodes={nodes} fams={fams} rootId={rootId} />
    </div>
  );
}
