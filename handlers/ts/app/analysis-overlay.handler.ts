// @migrated dsl-constructs 2026-03-18
// AnalysisOverlay Concept Implementation
// Maps graph analysis results to visual attributes for canvas overlays.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

/**
 * Interpolate HSL color along a blue->yellow->red gradient based on a 0-1 score.
 */
function scoreToColor(score: number): string {
  const t = Math.max(0, Math.min(1, score));
  let h: number, s: number, l: number;
  if (t <= 0.5) {
    const ratio = t / 0.5;
    h = 240 + (60 - 240) * ratio;
    s = 80;
    l = 60 + (50 - 60) * ratio;
  } else {
    const ratio = (t - 0.5) / 0.5;
    h = 60 + (0 - 60) * ratio;
    s = 80;
    l = 50;
  }
  return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
}

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
          highlighted.push({ source: edge.source, target: edge.target, color: highlightColor, width: highlightWidth });
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
        community: key, nodes: groups[key], color: communityColor(idx, total),
      }));
      return { type: 'cluster-boundary', clusters };
    }
    case 'heat-map': {
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

const analysisOverlayHandlerFunctional: FunctionalConceptHandler = {
  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const result = input.result as string;
    const kind = input.kind as string;
    const configStr = input.config as string | undefined;

    const validKinds = [
      'node-color', 'node-size', 'edge-highlight',
      'cluster-boundary', 'heat-map', 'label-annotation',
    ];
    if (!validKinds.includes(kind)) {
      let p = createProgram();
      return complete(p, 'invalid', { message: `Unknown overlay kind: ${kind}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let payload: AnalysisPayload;
    try {
      payload = JSON.parse(result) as AnalysisPayload;
    } catch {
      let p = createProgram();
      return complete(p, 'invalid', { message: 'Failed to parse analysis result' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let config: Record<string, unknown> | undefined;
    if (configStr) {
      try {
        config = JSON.parse(configStr) as Record<string, unknown>;
      } catch {
        let p = createProgram();
        return complete(p, 'invalid', { message: 'Failed to parse config' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    }

    const attributes = computeAttributes(kind, payload, config);
    const id = generateId();

    let p = createProgram();
    p = put(p, 'overlay', id, {
      id, canvas, kind, result,
      config: configStr || '',
      visible: true,
      attributes: JSON.stringify(attributes),
      createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { overlay: id, attributes: JSON.stringify(attributes) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    const overlay = input.overlay as string;

    let p = createProgram();
    p = spGet(p, 'overlay', overlay, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'overlay', overlay);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Overlay not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  toggle(input: Record<string, unknown>) {
    const overlay = input.overlay as string;

    let p = createProgram();
    p = spGet(p, 'overlay', overlay, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Visibility toggle resolved at runtime from bindings
        return complete(b, 'ok', { visible: '' });
      },
      (b) => complete(b, 'notfound', { message: 'Overlay not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listOverlays(input: Record<string, unknown>) {
    const canvas = input.canvas as string;

    let p = createProgram();
    p = find(p, 'overlay', { canvas }, 'all');
    return complete(p, 'ok', { overlays: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  updateConfig(input: Record<string, unknown>) {
    const overlay = input.overlay as string;
    const configStr = input.config as string;

    let config: Record<string, unknown> | undefined;
    try {
      config = JSON.parse(configStr) as Record<string, unknown>;
    } catch {
      let p = createProgram();
      return complete(p, 'invalid', { message: 'Failed to parse config' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'overlay', overlay, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Recompute attributes from stored result and new config at runtime
        let b2 = put(b, 'overlay', overlay, { config: configStr });
        return complete(b2, 'ok', { overlay, attributes: '' });
      },
      (b) => complete(b, 'notfound', { message: 'Overlay not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const analysisOverlayHandler = wrapFunctional(analysisOverlayHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { analysisOverlayHandlerFunctional };
