/**
 * Chart selection state: which chart type is shown, its root (and optional
 * second) person, what a click on a person does, and the per-chart-family
 * configuration — generation depths for the descendant/hourglass/double-
 * ancestor families, the fan arc, the ancestor branch filter, and the
 * distribution/sociogram/timeline chart options.
 *
 * Initial root/second/type/generations/click values come from the URL search
 * params; the URL-sync effect itself stays in ChartsApp.
 */
import { useState } from 'react';

export function useChartSelection(searchParams, sharedRootId) {
  const [rootId, setRootId] = useState(searchParams.get('person') || sharedRootId);
  const [secondId, setSecondId] = useState(searchParams.get('second') || null);
  const [chartType, setChartType] = useState(searchParams.get('type') || 'ancestor');
  const [generations, setGenerations] = useState(Math.min(8, Math.max(2, Number(searchParams.get('gen')) || 5)));
  const [chartClickAction, setChartClickAction] = useState(searchParams.get('click') || 'reroot');
  const [descendantGenerations, setDescendantGenerations] = useState(5);
  const [hourglassAncestorGens, setHourglassAncestorGens] = useState(4);
  const [hourglassDescendantGens, setHourglassDescendantGens] = useState(3);
  const [doubleAncestorLeftGens, setDoubleAncestorLeftGens] = useState(4);
  const [doubleAncestorRightGens, setDoubleAncestorRightGens] = useState(4);
  const [fanArcDegrees, setFanArcDegrees] = useState(180);
  const [ancestorBranch, setAncestorBranch] = useState('both');
  const [distributionType, setDistributionType] = useState('gender');
  const [distributionRelativeValues, setDistributionRelativeValues] = useState(false);
  const [distributionGraphType, setDistributionGraphType] = useState('bar');
  const [distributionFromYear, setDistributionFromYear] = useState('');
  const [distributionToYear, setDistributionToYear] = useState('');
  const [sociogramConfig, setSociogramConfig] = useState({
    showParents: true,
    showGrandparents: false,
    showPartners: true,
    showChildren: true,
    showAssociateRelationsOfStartPerson: true,
    showAssociateRelationsOfPartners: false,
    showAssociateRelationsOfChildren: false,
    associatedPersonsSpacing: 80,
  });
  const [timelineGrouping, setTimelineGrouping] = useState('none');
  const [timelineCollapse, setTimelineCollapse] = useState(true);
  const [timelineMarkerMode, setTimelineMarkerMode] = useState('bar');

  return {
    rootId, setRootId,
    secondId, setSecondId,
    chartType, setChartType,
    generations, setGenerations,
    chartClickAction, setChartClickAction,
    descendantGenerations, setDescendantGenerations,
    hourglassAncestorGens, setHourglassAncestorGens,
    hourglassDescendantGens, setHourglassDescendantGens,
    doubleAncestorLeftGens, setDoubleAncestorLeftGens,
    doubleAncestorRightGens, setDoubleAncestorRightGens,
    fanArcDegrees, setFanArcDegrees,
    ancestorBranch, setAncestorBranch,
    distributionType, setDistributionType,
    distributionRelativeValues, setDistributionRelativeValues,
    distributionGraphType, setDistributionGraphType,
    distributionFromYear, setDistributionFromYear,
    distributionToYear, setDistributionToYear,
    sociogramConfig, setSociogramConfig,
    timelineGrouping, setTimelineGrouping,
    timelineCollapse, setTimelineCollapse,
    timelineMarkerMode, setTimelineMarkerMode,
  };
}
