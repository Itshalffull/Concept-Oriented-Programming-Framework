// @migrated dsl-constructs 2026-03-18
// Canvas Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _canvasHandler: FunctionalConceptHandler = {
  addNode(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    let p = createProgram();
    p = spGet(p, 'canvas', canvas, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const nodes = JSON.parse(rec.nodes as string || '[]');
          const positions = JSON.parse(rec.positions as string || '{}');
          nodes.push(node);
          positions[node] = { x, y };
          return { ...bindings, _nodes: JSON.stringify(nodes), _positions: JSON.stringify(positions) };
        });
        b2 = putFrom(b2, 'canvas', canvas, (bindings) => ({
          ...bindings.existing as Record<string, unknown>,
          nodes: bindings._nodes as string,
          positions: bindings._positions as string,
        }));
        return complete(b2, 'ok', {});
      },
      (b) => {
        // Auto-create canvas on first node addition
        let b2 = put(b, 'canvas', canvas, {
          canvas,
          nodes: JSON.stringify([node]),
          positions: JSON.stringify({ [node]: { x, y } }),
          edges: '[]',
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  moveNode(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    let p = createProgram();
    p = spGet(p, 'canvas', canvas, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const nodes = JSON.parse(rec.nodes as string || '[]');
          const positions = JSON.parse(rec.positions as string || '{}');
          if (!nodes.includes(node)) {
            return { ...bindings, _nodeExists: false };
          }
          positions[node] = { x, y };
          return { ...bindings, _nodeExists: true, _positions: JSON.stringify(positions) };
        });
        return branch(b2,
          (bindings) => !!bindings._nodeExists,
          (thenB) => {
            let t = putFrom(thenB, 'canvas', canvas, (bindings) => ({
              ...bindings.existing as Record<string, unknown>,
              positions: bindings._positions as string,
            }));
            return complete(t, 'ok', {});
          },
          (elseB) => complete(elseB, 'notfound', { message: 'Node not found' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  connectNodes(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const from = input.from as string;
    const to = input.to as string;

    let p = createProgram();
    p = spGet(p, 'canvas', canvas, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const nodes = JSON.parse(rec.nodes as string || '[]');
          const positions = JSON.parse(rec.positions as string || '{}');
          const edges = JSON.parse(rec.edges as string || '[]');
          if (!nodes.includes(from)) { nodes.push(from); positions[from] = { x: 0, y: 0 }; }
          if (!nodes.includes(to)) { nodes.push(to); positions[to] = { x: 0, y: 0 }; }
          edges.push({ from, to });
          return { ...bindings, _nodes: JSON.stringify(nodes), _positions: JSON.stringify(positions), _edges: JSON.stringify(edges) };
        });
        b2 = putFrom(b2, 'canvas', canvas, (bindings) => ({
          ...bindings.existing as Record<string, unknown>,
          nodes: bindings._nodes as string,
          positions: bindings._positions as string,
          edges: bindings._edges as string,
        }));
        return complete(b2, 'ok', {});
      },
      (b) => {
        // Auto-create canvas
        let b2 = put(b, 'canvas', canvas, {
          canvas,
          nodes: JSON.stringify([from, to]),
          positions: JSON.stringify({ [from]: { x: 0, y: 0 }, [to]: { x: 0, y: 0 } }),
          edges: JSON.stringify([{ from, to }]),
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  groupNodes(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const nodeList = input.nodes as string;
    const group = input.group as string;

    let p = createProgram();
    p = spGet(p, 'canvas', canvas, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const nodes = JSON.parse(rec.nodes as string || '[]');
          const groups = JSON.parse(rec.groups as string || '{}');
          const requestedNodes = JSON.parse(nodeList || '[]');
          const missing = requestedNodes.filter((n: string) => !nodes.includes(n));
          if (missing.length > 0) {
            return { ...bindings, _allExist: false };
          }
          groups[group] = requestedNodes;
          return { ...bindings, _allExist: true, _groups: JSON.stringify(groups) };
        });
        return branch(b2,
          (bindings) => !!bindings._allExist,
          (thenB) => {
            let t = putFrom(thenB, 'canvas', canvas, (bindings) => ({
              ...bindings.existing as Record<string, unknown>,
              groups: bindings._groups as string,
            }));
            return complete(t, 'ok', {});
          },
          (elseB) => complete(elseB, 'notfound', { message: 'Node not found' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  embedFile(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const file = input.file as string;

    let p = createProgram();
    p = spGet(p, 'canvas', canvas, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const nodes = JSON.parse(rec.nodes as string || '[]');
          const embeds = JSON.parse(rec.embeds as string || '{}');
          if (!nodes.includes(node)) {
            return { ...bindings, _nodeExists: false };
          }
          embeds[node] = file;
          return { ...bindings, _nodeExists: true, _embeds: JSON.stringify(embeds) };
        });
        return branch(b2,
          (bindings) => !!bindings._nodeExists,
          (thenB) => {
            let t = putFrom(thenB, 'canvas', canvas, (bindings) => ({
              ...bindings.existing as Record<string, unknown>,
              embeds: bindings._embeds as string,
            }));
            return complete(t, 'ok', {});
          },
          (elseB) => complete(elseB, 'notfound', { message: 'Node not found' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const canvasHandler = autoInterpret(_canvasHandler);

