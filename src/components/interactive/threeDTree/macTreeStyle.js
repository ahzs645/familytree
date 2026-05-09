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
  regularConnectorRadius: 38,
  featuredConnectorRadius: 104,
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
