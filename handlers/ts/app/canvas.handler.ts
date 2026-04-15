// @clef-handler style=functional
// Canvas Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, del, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type R = StorageProgram<{ variant: string; [key: string]: unknown }>;

const _handler: FunctionalConceptHandler = {
  addNode(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'canvas', canvas, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          const positions: Record<string, unknown> = JSON.parse(existing.positions as string || '{}');
          nodes.push(node);
          positions[node] = { x, y };
          return { ...existing, nodes: JSON.stringify(nodes), positions: JSON.stringify(positions) };
        });
        return complete(b2, 'ok', { id: canvas, output: { id: canvas } });
      },
      (b) => {
        let b2 = put(b, 'canvas', canvas, {
          canvas,
          nodes: JSON.stringify([node]),
          positions: JSON.stringify({ [node]: { x, y } }),
          edges: '[]',
        });
        return complete(b2, 'ok', { id: canvas, output: { id: canvas } });
      },
    ) as R;
  },

  moveNode(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          return nodes.includes(node) ? existing : null;
        }, 'canvasWithNode');
        return branch(b2, 'canvasWithNode',
          (c) => {
            let c2 = putFrom(c, 'canvas', canvas, (bindings) => {
              const existing = bindings.canvasWithNode as Record<string, unknown>;
              const positions: Record<string, unknown> = JSON.parse(existing.positions as string || '{}');
              positions[node] = { x, y };
              return { ...existing, positions: JSON.stringify(positions) };
            });
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'notfound', { message: 'Node not found' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    ) as R;
  },

  connectNodes(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const from = input.from as string;
    const to = input.to as string;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'canvas', canvas, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          const positions: Record<string, unknown> = JSON.parse(existing.positions as string || '{}');
          const edges: Array<{ from: string; to: string }> = JSON.parse(existing.edges as string || '[]');
          if (!nodes.includes(from)) { nodes.push(from); positions[from] = { x: 0, y: 0 }; }
          if (!nodes.includes(to)) { nodes.push(to); positions[to] = { x: 0, y: 0 }; }
          edges.push({ from, to });
          return { ...existing, nodes: JSON.stringify(nodes), positions: JSON.stringify(positions), edges: JSON.stringify(edges) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => {
        let b2 = put(b, 'canvas', canvas, {
          canvas,
          nodes: JSON.stringify([from, to]),
          positions: JSON.stringify({ [from]: { x: 0, y: 0 }, [to]: { x: 0, y: 0 } }),
          edges: JSON.stringify([{ from, to }]),
        });
        return complete(b2, 'ok', {});
      },
    ) as R;
  },

  groupNodes(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const nodeList = input.nodes as string;
    const group = input.group as string;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'canvas', canvas, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          const groups: Record<string, unknown> = JSON.parse(existing.groups as string || '{}');
          const requestedNodes: string[] = JSON.parse(nodeList || '[]');
          for (const n of requestedNodes) {
            if (!nodes.includes(n)) nodes.push(n);
          }
          groups[group] = requestedNodes;
          return { ...existing, nodes: JSON.stringify(nodes), groups: JSON.stringify(groups) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    ) as R;
  },

  removeItem(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const node = input.node as string;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          return nodes.includes(node) ? existing : null;
        }, 'canvasWithNode');
        return branch(b2, 'canvasWithNode',
          (c) => {
            let c2 = putFrom(c, 'canvas', canvas, (bindings) => {
              const existing = bindings.canvasWithNode as Record<string, unknown>;
              const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
              const positions: Record<string, unknown> = JSON.parse(existing.positions as string || '{}');
              const filtered = nodes.filter((n: string) => n !== node);
              delete positions[node];
              return { ...existing, nodes: JSON.stringify(filtered), positions: JSON.stringify(positions) };
            });
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'notfound', { message: 'Node not found on canvas' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    ) as R;
  },

  resizeItem(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const width = input.width as number;
    const height = input.height as number;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          return nodes.includes(node) ? existing : null;
        }, 'canvasWithNode');
        return branch(b2, 'canvasWithNode',
          (c) => {
            let c2 = putFrom(c, 'canvas', canvas, (bindings) => {
              const existing = bindings.canvasWithNode as Record<string, unknown>;
              const sizes: Record<string, unknown> = JSON.parse(existing.sizes as string || '{}');
              sizes[node] = { width, height };
              return { ...existing, sizes: JSON.stringify(sizes) };
            });
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'notfound', { message: 'Node not found on canvas' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    ) as R;
  },

  createConnector(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const connector = input.connector as string;
    const fromNode = input.fromNode as string;
    const toNode = input.toNode as string;
    const kind = input.kind as string;

    const allowedKinds = ['default', 'branch', 'catch'];
    if (!allowedKinds.includes(kind)) {
      return complete(createProgram(), 'invalid_kind', {
        message: `kind must be one of: ${allowedKinds.join(', ')}`,
      }) as R;
    }

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        // Check that fromNode and toNode exist in the canvas node list
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          if (!nodes.includes(fromNode)) return { missingNode: fromNode };
          if (!nodes.includes(toNode)) return { missingNode: toNode };
          return null;
        }, '_missingCheck');
        return branch(b2, '_missingCheck',
          // _missingCheck is non-null means a node was missing
          (c) => {
            return completeFrom(c, 'missing_node', (bindings) => {
              const mc = bindings._missingCheck as Record<string, unknown>;
              return { message: `Node not found: ${mc.missingNode}` };
            });
          },
          // Both nodes exist — now check for duplicate connector
          (c) => {
            let c2 = get(c, 'connector', `${canvas}:${connector}`, '_existingConn');
            return branch(c2, '_existingConn',
              (d) => complete(d, 'duplicate', { message: `Connector ${connector} already exists on canvas ${canvas}` }),
              (d) => {
                let d2 = put(d, 'connector', `${canvas}:${connector}`, {
                  canvas,
                  connector,
                  source: fromNode,
                  target: toNode,
                  kind,
                });
                return complete(d2, 'ok', { connector });
              },
            );
          },
        );
      },
      (b) => complete(b, 'error', { message: `Canvas not found: ${canvas}` }),
    ) as R;
  },

  removeConnector(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const connector = input.connector as string;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = get(b, 'connector', `${canvas}:${connector}`, '_existingConn');
        return branch(b2, '_existingConn',
          (c) => {
            let c2 = del(c, 'connector', `${canvas}:${connector}`);
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'notfound', { message: `Connector ${connector} not found on canvas ${canvas}` }),
        );
      },
      (b) => complete(b, 'error', { message: `Canvas not found: ${canvas}` }),
    ) as R;
  },

  embedFile(input: Record<string, unknown>): R {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const file = input.file as string;

    let p = createProgram();
    p = get(p, 'canvas', canvas, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const nodes: string[] = JSON.parse(existing.nodes as string || '[]');
          return nodes.includes(node) ? existing : null;
        }, 'canvasWithNode');
        return branch(b2, 'canvasWithNode',
          (c) => {
            let c2 = putFrom(c, 'canvas', canvas, (bindings) => {
              const existing = bindings.canvasWithNode as Record<string, unknown>;
              const embeds: Record<string, unknown> = JSON.parse(existing.embeds as string || '{}');
              embeds[node] = file;
              return { ...existing, embeds: JSON.stringify(embeds) };
            });
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'notfound', { message: 'Node not found' }),
        );
      },
      (b) => complete(b, 'notfound', { message: 'Canvas not found' }),
    ) as R;
  },
};

type Result = { variant: string; [key: string]: unknown };

const canvasHandlerWithList: FunctionalConceptHandler = {
  ..._handler,

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'canvas', {}, '_allCanvases');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allCanvases as Array<Record<string, unknown>>) ?? [];
      const canvases = all.filter((rec) => rec.id !== '__registered');
      return { canvases };
    }) as StorageProgram<Result>;
  },
};

export const canvasHandler = autoInterpret(canvasHandlerWithList);
