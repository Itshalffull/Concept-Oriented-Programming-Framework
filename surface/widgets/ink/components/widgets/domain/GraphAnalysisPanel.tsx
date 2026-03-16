// ============================================================
// Clef Surface Ink Widget — GraphAnalysisPanel
//
// Analysis panel for graph metrics and insights.
// Adapts the graph-analysis-panel.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface GraphAnalysisPanelProps {
  /** Canvas identifier. */
  canvasId: string;
  /** Graph data as serialized string. */
  graphData?: string;
  /** Selected analysis category. */
  selectedCategory?: 'centrality' | 'community' | 'path' | 'pattern' | 'flow' | 'structural' | 'clustering';
  /** Selected algorithm within the category. */
  selectedAlgorithm?: string;
  /** Algorithm configuration as JSON string. */
  algorithmConfig?: string;
  /** Result identifier. */
  resultId?: string;
  /** Overlay kinds to display. */
  overlayKinds?: string[];
  /** Report format. */
  reportFormat?: 'table' | 'summary' | 'dashboard';
  /** Whether to auto-apply overlay. */
  autoOverlay?: boolean;
  /** Maximum result history entries. */
  maxResultHistory?: number;
}

// --------------- Component ---------------

export const GraphAnalysisPanel: React.FC<GraphAnalysisPanelProps> = ({
  canvasId,
  selectedCategory = 'centrality',
  selectedAlgorithm,
  reportFormat = 'summary',
}) => (
  <Box flexDirection="column" borderStyle="single">
    <Text bold>Graph Analysis: {canvasId}</Text>
    <Text>Category: {selectedCategory}</Text>
    {selectedAlgorithm && <Text>Algorithm: {selectedAlgorithm}</Text>}
    <Text>Format: {reportFormat}</Text>
  </Box>
);

export default GraphAnalysisPanel;
