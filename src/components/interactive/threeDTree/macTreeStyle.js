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
  regularModelSize: 92,
  featuredModelSize: 128,
  regularLabelWidth: 164,
  regularLabelHeight: 60,
  regularShadowWidth: 194,
  regularShadowHeight: 66,
  featuredShadowScale: 1.16,
  // Distance from node center where connector lines should anchor.
  // Person model top-of-head sits ~+104 above center; label bottom sits ~-89.
  // Vertical radii must exceed those so lines never pierce the figure.
  regularConnectorRadius: 110,
  featuredConnectorRadius: 132,
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
