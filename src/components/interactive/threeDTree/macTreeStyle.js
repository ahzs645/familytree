export const MAC_FAMILY_GRAPH_LAYOUT = {
  generationStep: 274,
  childGap: 176,
  rootCardWidth: 640,
  familyPadding: 250,
  blockGap: 150,
  branchGap: 96,
  rootParentGap: 560,
  maxDepth: 4,
  visibleXRadius: 1560,
  maxFocusWidth: 3020,
  maxFocusHeight: 1520,
  regularModelSize: 76,
  featuredModelSize: 108,
  regularLabelWidth: 164,
  regularLabelHeight: 60,
  regularShadowWidth: 194,
  regularShadowHeight: 66,
  featuredShadowScale: 1.16,
  // Distance from node center where connector lines should anchor. Kept just
  // inside the generation band's half-height so lines attach to the figure
  // rather than re-emerging below the band edge (which reads as "detached").
  regularConnectorRadius: 90,
  featuredConnectorRadius: 104,
  // Horizontal radii are much smaller — partner lines span the gap between
  // adjacent figures and need to start near the figure's silhouette edge.
  regularHorizontalConnectorRadius: 60,
  featuredHorizontalConnectorRadius: 90,
  childBusGap: 22,
  parentBridgeGap: 28,
  familyRouteSplitGap: 260,
  maxFamilyHorizontalSpan: 820,
  maxParentBridgeSpan: 600,
};

export function macBandSplitGap(generation) {
  if (generation >= 0) return Infinity;
  if (generation === -1) return 980;
  if (generation === -2) return 760;
  if (generation === -3) return 560;
  return 520;
}
