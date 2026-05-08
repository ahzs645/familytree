/**
 * State for the Relationship-Path chart: the discovered paths between two
 * people, the currently-selected path, and the search controls (bloodline
 * filter, full-blood filter, max-paths, max-depth).
 *
 * The actual path-finding effect remains in ChartsApp because it depends
 * on the trees that ChartsApp loads.
 */
import { useState } from 'react';

export function useRelationshipPaths() {
  const [relationshipPaths, setRelationshipPaths] = useState([]);
  const [selectedRelationshipPathId, setSelectedRelationshipPathId] = useState(null);
  const [relationshipBloodlineOnly, setRelationshipBloodlineOnly] = useState(false);
  const [relationshipMaxPaths, setRelationshipMaxPaths] = useState(12);
  const [relationshipMaxDepth, setRelationshipMaxDepth] = useState(12);
  const [relationshipExcludeNonBiological, setRelationshipExcludeNonBiological] = useState(false);

  return {
    relationshipPaths,
    setRelationshipPaths,
    selectedRelationshipPathId,
    setSelectedRelationshipPathId,
    relationshipBloodlineOnly,
    setRelationshipBloodlineOnly,
    relationshipMaxPaths,
    setRelationshipMaxPaths,
    relationshipMaxDepth,
    setRelationshipMaxDepth,
    relationshipExcludeNonBiological,
    setRelationshipExcludeNonBiological,
  };
}
