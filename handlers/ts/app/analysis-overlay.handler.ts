// AnalysisOverlay Concept Implementation
// Maps graph analysis results to visual attributes for canvas overlays.
import type { ConceptHandler } from '@clef/runtime';

/**
 * Interpolate HSL color along a blue→yellow→red gradient based on a 0–1 score.
 * Low (0) = hsl(240,80%,60%) blue
 * Mid (0.5) = hsl(60,80%,50%) yellow
 * High (1) = hsl(0,80%,50%) red
 */
function scoreToColor(score: number): string {
  const t = Math.max(0, Math.min(1, score));
  let h: number, s: number, l: number;
  if (t <= 0.5) {
    // blue (240) → yellow (60): hue decreases 240→60
    const ratio = t / 0.5;
    h = 240 + (60 - 240) * ratio;
    s = 80;
    l = 60 + (50 - 60) * ratio;
  } else {
    // yellow (60) → red (0): hue decreases 60→0
    const ratio = (t - 0.5) / 0.5;
    h = 60 + (0 - 60) * ratio;
    s = 80;
    l = 50;
  }
  return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
}

/**
 * Generate a distinct color for community index using evenly spaced hues.
 */
function communityColor(index: number, total: number): string {
  const hue = Math.round((360 / Math.max(total, 1)) * index) % 360;
  return `hsl(${hue},70%,55%)`;
}

function generateId(): string {
  return `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AnalysisNode {
  id: string;
  score?: number;
  community?: number;
  rank?: number;
  label?: string;
}

interface AnalysisEdge {
  source: string;
  target: string;
  weight?: number;
  matched?: boolean;
}

interface AnalysisPayload {
  nodes?: AnalysisNode[];
  edges?: AnalysisEdge[];
  communities?: Record<string, number>;
  scores?: Record<string, number>;
}

function computeAttributes(
  kind: string,
  payload: AnalysisPayload,
  config?: Record<string, unknown>,
): Record<string, unknown> {
  const nodes = payload.nodes || [];
  const edges = payload.edges || [];
  const scores = payload.scores || {};

  switch (kind) {
    case 'node-color': {
      // If communities are present, use distinct colors; otherwise map scores
      if (payload.communities) {
        const entries = Object.entries(payload.communities);
        const uniqueCommunities = [...new Set(entries.map(([, c]) => c))];
        const total = uniqueCommunities.length;
        const colorMap: Record<string, string> = {};
        for (const [nodeId, community] of entries) {
          const idx = uniqueCommunities.indexOf(community);
          colorMap[nodeId] = communityColor(idx, total);
        }
        return { type: 'node-color', colorMap };
      }
      // Score-based gradient
      const colorMap: Record<string, string> = {};
      for (const node of nodes) {
        const s = node.score ?? scores[node.id] ?? 0;
        colorMap[node.id] = scoreToColor(s);
      }
      for (const [id, s] of Object.entries(scores)) {
        if (!colorMap[id]) {
          colorMap[id] = scoreToColor(s);
        }
      }
      return { type: 'node-color', colorMap };
    }

    case 'node-size': {
      // Map scores to scale factor 0.5x–3x
      const minScale = (config?.minScale as number) ?? 0.5;
      const maxScale = (config?.maxScale as number) ?? 3.0;
      const sizeMap: Record<string, number> = {};
      for (const node of nodes) {
        const s = node.score ?? scores[node.id] ?? 0;
        const t = Math.max(0, Math.min(1, s));
        sizeMap[node.id] = minScale + (maxScale - minScale) * t;
      }
      for (const [id, s] of Object.entries(scores)) {
        if (!sizeMap[id]) {
          const t = Math.max(0, Math.min(1, s));
          sizeMap[id] = minScale + (maxScale - minScale) * t;
        }
      }
      return { type: 'node-size', sizeMap };
    }

    case 'edge-highlight': {
      const highlightColor = (config?.color as string) ?? 'hsl(30,90%,50%)';
      const highlightWidth = (config?.width as number) ?? 3;
      const highlighted: Array<{ source: string; target: string; color: string; width: number }> = [];
      for (const edge of edges) {
        if (edge.matched) {
          highlighted.push({
            source: edge.source,
            target: edge.target,
            color: highlightColor,
            width: highlightWidth,
          });
        }
      }
      return { type: 'edge-highlight', highlighted };
    }

    case 'cluster-boundary': {
      const communities = payload.communities || {};
      const groups: Record<string, string[]> = {};
      for (const [nodeId, community] of Object.entries(communities)) {
        const key = String(community);
        if (!groups[key]) groups[key] = [];
        groups[key].push(nodeId);
      }
      // Also extract from nodes if they have community field
      for (const node of nodes) {
        if (node.community !== undefined) {
          const key = String(node.community);
          if (!groups[key]) groups[key] = [];
          if (!groups[key].includes(node.id)) {
            groups[key].push(node.id);
          }
        }
      }
      const uniqueKeys = Object.keys(groups);
      const total = uniqueKeys.length;
      const clusters = uniqueKeys.map((key, idx) => ({
        community: key,
        nodes: groups[key],
        color: communityColor(idx, total),
      }));
      return { type: 'cluster-boundary', clusters };
    }

    case 'heat-map': {
      // Map scores to intensity 0–1
      const intensityMap: Record<string, number> = {};
      for (const node of nodes) {
        const s = node.score ?? scores[node.id] ?? 0;
        intensityMap[node.id] = Math.max(0, Math.min(1, s));
      }
      for (const [id, s] of Object.entries(scores)) {
        if (intensityMap[id] === undefined) {
          intensityMap[id] = Math.max(0, Math.min(1, s));
        }
      }
      return { type: 'heat-map', intensityMap };
    }

    case 'label-annotation': {
      const labels: Record<string, string> = {};
      for (const node of nodes) {
        const score = node.score ?? scores[node.id];
        const rank = node.rank;
        const parts: string[] = [];
        if (rank !== undefined) parts.push(`#${rank}`);
        if (score !== undefined) parts.push(score.toFixed(3));
        if (node.label) parts.push(node.label);
        labels[node.id] = parts.join(' ');
      }
      // Handle scores-only entries not in nodes
      for (const [id, s] of Object.entries(scores)) {
        if (!labels[id]) {
          labels[id] = s.toFixed(3);
        }
      }
      return { type: 'label-annotation', labels };
    }

    default:
      return { type: kind, raw: true };
  }
}

export const analysisOverlayHandler: ConceptHandler = {
  async apply(input, storage) {
    const canvas = input.canvas as string;
    const result = input.result as string;
    const kind = input.kind as string;
    const configStr = input.config as string | undefined;

    const validKinds = [
      'node-color', 'node-size', 'edge-highlight',
      'cluster-boundary', 'heat-map', 'label-annotation',
    ];
    if (!validKinds.includes(kind)) {
      return { variant: 'invalid', message: `Unknown overlay kind: ${kind}` };
    }

    let payload: AnalysisPayload;
    try {
      payload = JSON.parse(result) as AnalysisPayload;
    } catch {
      return { variant: 'invalid', message: 'Failed to parse analysis result' };
    }

    let config: Record<string, unknown> | undefined;
    if (configStr) {
      try {
        config = JSON.parse(configStr) as Record<string, unknown>;
      } catch {
        return { variant: 'invalid', message: 'Failed to parse config' };
      }
    }

    const attributes = computeAttributes(kind, payload, config);
    const id = generateId();

    await storage.put('overlay', id, {
      id,
      canvas,
      kind,
      result,
      config: configStr || '',
      visible: true,
      attributes: JSON.stringify(attributes),
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', overlay: id, attributes: JSON.stringify(attributes) };
  },

  async remove(input, storage) {
    const overlay = input.overlay as string;

    const existing = await storage.get('overlay', overlay);
    if (!existing) {
      return { variant: 'notfound', message: 'Overlay not found' };
    }

    await storage.del('overlay', overlay);
    return { variant: 'ok' };
  },

  async toggle(input, storage) {
    const overlay = input.overlay as string;

    const existing = await storage.get('overlay', overlay);
    if (!existing) {
      return { variant: 'notfound', message: 'Overlay not found' };
    }

    const nowVisible = !existing.visible;
    await storage.put('overlay', overlay, {
      ...existing,
      visible: nowVisible,
    });

    return { variant: 'ok', visible: nowVisible ? 'visible' : 'hidden' };
  },

  async listOverlays(input, storage) {
    const canvas = input.canvas as string;

    const all = await storage.find('overlay', { canvas });
    const items = all.map((o: Record<string, unknown>) => ({
      id: o.id,
      kind: o.kind,
      visible: o.visible,
      createdAt: o.createdAt,
    }));

    return { variant: 'ok', overlays: JSON.stringify(items) };
  },

  async updateConfig(input, storage) {
    const overlay = input.overlay as string;
    const configStr = input.config as string;

    const existing = await storage.get('overlay', overlay);
    if (!existing) {
      return { variant: 'notfound', message: 'Overlay not found' };
    }

    let config: Record<string, unknown> | undefined;
    try {
      config = JSON.parse(configStr) as Record<string, unknown>;
    } catch {
      return { variant: 'invalid', message: 'Failed to parse config' };
    }

    let payload: AnalysisPayload;
    try {
      payload = JSON.parse(existing.result as string) as AnalysisPayload;
    } catch {
      return { variant: 'invalid', message: 'Failed to parse stored result' };
    }

    const attributes = computeAttributes(existing.kind as string, payload, config);

    await storage.put('overlay', overlay, {
      ...existing,
      config: configStr,
      attributes: JSON.stringify(attributes),
    });

    return { variant: 'ok', overlay, attributes: JSON.stringify(attributes) };
  },
};
