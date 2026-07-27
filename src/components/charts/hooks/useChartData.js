/**
 * Data pipeline feeding the chart canvas. Owns the loaded ancestor/descendant
 * trees (plus the second person's tree), the record-backed builder outputs
 * (timeline/genogram/sociogram/distribution/virtual), the relationship-path
 * search, the generation index and privacy-filtered person list, and the
 * portrait loading for "Show portraits".
 *
 * All effects are moved verbatim from ChartsApp; inputs arrive as the result
 * objects of the sibling state hooks so value names stay identical.
 */
import { useEffect, useMemo, useState } from 'react';
import { buildAncestorTree, buildDescendantTree } from '../../../lib/treeQuery.js';
import { findRelationshipPaths } from '../../../lib/relationshipPath.js';
import { buildTimelineData } from '../../../lib/chartData/timelineBuilder.js';
import { buildGenogramData } from '../../../lib/chartData/genogramBuilder.js';
import { buildDistributionData } from '../../../lib/chartData/distributionBuilder.js';
import { buildSociogramData } from '../../../lib/chartData/sociogramBuilder.js';
import { buildVirtualTreeData } from '../../../lib/chartData/virtualTreeBuilder.js';
import { buildGenerationIndex } from '../coloring.js';
import { loadChartPortraits } from '../ChartContentContext.jsx';

export function useChartData({
  selection,
  needsSecond,
  relationship,
  virtualOptions,
  persons,
  privateIds,
  hidePrivateChartInfo,
  showPortraits,
  setChartPhotos,
}) {
  const {
    rootId, secondId, chartType, generations, descendantGenerations,
    hourglassAncestorGens, hourglassDescendantGens, doubleAncestorLeftGens,
    doubleAncestorRightGens, ancestorBranch, distributionType,
    distributionRelativeValues, distributionGraphType, distributionFromYear,
    distributionToYear, sociogramConfig, timelineGrouping, timelineCollapse,
    timelineMarkerMode,
  } = selection;
  const {
    relationshipPaths, setRelationshipPaths,
    selectedRelationshipPathId, setSelectedRelationshipPathId,
    relationshipBloodlineOnly, relationshipMaxPaths, relationshipMaxDepth,
    relationshipExcludeNonBiological,
  } = relationship;
  const {
    virtualSource, virtualOrientation, virtualHSpacing, virtualVSpacing,
    virtualSymbolMode, virtualColorMode, setVirtualTreeData,
  } = virtualOptions;

  const [ancestorTree, setAncestorTree] = useState(null);
  const [descendantTree, setDescendantTree] = useState(null);
  const [secondAncestorTree, setSecondAncestorTree] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [genogramData, setGenogramData] = useState(null);
  const [distributionData, setDistributionData] = useState(null);
  const [sociogramData, setSociogramData] = useState(null);

  // Build trees as inputs change.
  // Ancestor depth follows the relevant per-chart ancestor count so hourglass
  // can keep its ancestor ring small while the main ancestor chart uses the
  // user's full `generations` slider. Descendant depth follows the matching
  // per-chart descendant count so descendant/genogram/sociogram charts no
  // longer get silently clamped to 4 generations.
  const ancestorDepth = chartType === 'hourglass'
    ? hourglassAncestorGens
    : chartType === 'double-ancestor'
      ? doubleAncestorLeftGens
      : generations;
  const descendantDepth = chartType === 'hourglass'
    ? hourglassDescendantGens
    : chartType === 'descendant' || chartType === 'genogram' || chartType === 'sociogram' || chartType === 'tree' || chartType === 'symmetrical' || chartType === 'family-chart' || chartType === 'radial-descendant' || chartType === 'lifespan'
      ? descendantGenerations
      : descendantGenerations;

  useEffect(() => {
    if (!rootId) return;
    let cancelled = false;
    (async () => {
      const ancestorOptions = chartType === 'ancestor' || chartType === 'fan' || chartType === 'circular'
        || chartType === 'fractal-tree' || chartType === 'fractal-h-tree' || chartType === 'square-tree'
        ? { branch: ancestorBranch }
        : undefined;
      const a = await buildAncestorTree(rootId, ancestorDepth, ancestorOptions);
      const d = await buildDescendantTree(rootId, descendantDepth);
      if (!cancelled) {
        setAncestorTree(a);
        setDescendantTree(d);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootId, ancestorDepth, descendantDepth, chartType, ancestorBranch]);

  useEffect(() => {
    if (!secondId || !needsSecond) {
      setSecondAncestorTree(null);
      setRelationshipPaths([]);
      setSelectedRelationshipPathId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (chartType === 'double-ancestor') {
        const a2 = await buildAncestorTree(secondId, doubleAncestorRightGens);
        if (!cancelled) setSecondAncestorTree(a2);
      } else if (chartType === 'relationship') {
        const result = await findRelationshipPaths(rootId, secondId, {
          bloodlineOnly: relationshipBloodlineOnly,
          maxPaths: relationshipMaxPaths,
          maxDepth: relationshipMaxDepth,
          excludeNonBiological: relationshipExcludeNonBiological,
        });
        if (!cancelled) {
          const paths = result.paths || [];
          setRelationshipPaths(paths);
          setSelectedRelationshipPathId((current) => {
            if (current && paths.some((path) => path.id === current)) return current;
            return result.selectedPathId || paths[0]?.id || null;
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondId, chartType, generations, doubleAncestorRightGens, needsSecond, rootId, relationshipBloodlineOnly, relationshipMaxPaths, relationshipMaxDepth, relationshipExcludeNonBiological]);

  // Build record-backed timeline/genogram data from chartData builders when the
  // active chart needs events/facts. The builders query PersonEvent,
  // FamilyEvent, PersonFact, AssociateRelation so the rendered chart reflects
  // more than the ancestor/descendant tree skeleton.
  useEffect(() => {
    if (chartType !== 'timeline') { setTimelineData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildTimelineData({
          rootPersonId: rootId || null,
          grouping: timelineGrouping,
          collapseForBestFit: timelineCollapse,
          markerMode: timelineMarkerMode,
        });
        if (!cancelled) setTimelineData(data);
      } catch (_error) {
        if (!cancelled) setTimelineData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, timelineGrouping, timelineCollapse, timelineMarkerMode]);

  useEffect(() => {
    if (chartType !== 'genogram') { setGenogramData(null); return undefined; }
    if (!rootId) { setGenogramData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildGenogramData({ rootPersonId: rootId, generations: descendantGenerations });
        if (!cancelled) setGenogramData(data);
      } catch (_error) {
        if (!cancelled) setGenogramData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, descendantGenerations]);

  // Sociogram uses its own builder (buildSociogramData) so the relationship
  // inclusion toggles (parents/grandparents/partners/children/associates) and
  // the associated-persons spacing slider drive a dedicated social-graph
  // render rather than reusing the genogram descendant pipeline.
  useEffect(() => {
    if (chartType !== 'sociogram') { setSociogramData(null); return undefined; }
    if (!rootId) { setSociogramData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildSociogramData({ rootPersonId: rootId, ...sociogramConfig });
        if (!cancelled) setSociogramData(data);
      } catch (_error) {
        if (!cancelled) setSociogramData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, sociogramConfig]);

  useEffect(() => {
    if (chartType !== 'distribution') { setDistributionData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const fromYear = Number.parseInt(distributionFromYear, 10);
        const toYear = Number.parseInt(distributionToYear, 10);
        const data = await buildDistributionData({
          distributionType,
          relativeValues: distributionRelativeValues,
          graphType: distributionGraphType,
          fromYear: Number.isFinite(fromYear) ? fromYear : null,
          toYear: Number.isFinite(toYear) ? toYear : null,
        });
        if (!cancelled) setDistributionData(data);
      } catch (_error) {
        if (!cancelled) setDistributionData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, distributionType, distributionRelativeValues, distributionGraphType, distributionFromYear, distributionToYear]);

  useEffect(() => {
    if (chartType !== 'virtual') { setVirtualTreeData(null); return undefined; }
    if (!rootId) { setVirtualTreeData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildVirtualTreeData({
          rootPersonId: rootId,
          collectMode: virtualSource,
          generations,
          hSpacing: virtualHSpacing,
          vSpacing: virtualVSpacing,
          orientation: virtualOrientation,
          symbolMode: virtualSymbolMode,
          colorMode: virtualColorMode,
        });
        if (!cancelled) setVirtualTreeData(data);
      } catch (_error) {
        if (!cancelled) setVirtualTreeData(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, rootId, virtualSource, generations, virtualHSpacing, virtualVSpacing, virtualOrientation, virtualSymbolMode, virtualColorMode]);

  const selectedRelationshipResult = useMemo(() => (
    relationshipPaths.find((path) => path.id === selectedRelationshipPathId) || relationshipPaths[0] || null
  ), [relationshipPaths, selectedRelationshipPathId]);

  // Record names participating in the currently selected relationship path,
  // for highlighting inside the Virtual Tree 3D renderer.
  const relationshipPathIds = useMemo(() => {
    const steps = selectedRelationshipResult?.steps;
    if (!Array.isArray(steps)) return [];
    return steps.map((step) => step.recordName).filter(Boolean);
  }, [selectedRelationshipResult]);

  const virtualLayoutOptions = useMemo(() => ({
    hSpacing: virtualHSpacing,
    vSpacing: virtualVSpacing,
    orientation: virtualOrientation,
  }), [virtualHSpacing, virtualVSpacing, virtualOrientation]);

  const generationIndex = useMemo(
    () => buildGenerationIndex({ ancestorTree, descendantTree }),
    [ancestorTree, descendantTree]
  );

  // Load portraits for the charted persons when "Show portraits" is on (#25).
  useEffect(() => {
    if (!showPortraits) { setChartPhotos(null); return undefined; }
    let cancelled = false;
    const ids = [...(generationIndex?.byId?.keys() || [])];
    loadChartPortraits(ids).then((map) => { if (!cancelled) setChartPhotos(map); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPortraits, generationIndex]);

  // People available to the chart's data sources (person browser, picker,
  // distribution chart). When "Hide Information marked as Private" is on we drop
  // records flagged private so the rendered chart — and therefore exports —
  // never surface them.
  const chartPersons = useMemo(() => (
    hidePrivateChartInfo && privateIds.size
      ? persons.filter((person) => !privateIds.has(person.recordName))
      : persons
  ), [persons, privateIds, hidePrivateChartInfo]);

  return {
    ancestorTree,
    descendantTree,
    secondAncestorTree,
    timelineData,
    genogramData,
    distributionData,
    sociogramData,
    selectedRelationshipResult,
    relationshipPathIds,
    virtualLayoutOptions,
    generationIndex,
    chartPersons,
  };
}
