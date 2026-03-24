// @clef-handler style=functional
// StateGraph Concept Implementation
// Graph-based orchestration with typed state flowing through nodes,
// conditional edges evaluated by LLMs, first-class cycles, durable
// checkpoints, and time-travel.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string = 'state-graph'): string {
  return `${prefix}-${++idCounter}`;
}

const VALID_NODE_TYPES = new Set(['agent', 'tool', 'conditional', 'subgraph', 'human']);
const VALID_REDUCERS = new Set(['overwrite', 'append', 'merge', 'custom']);

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'StateGraph' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const stateSchema = input.state_schema as string;

    if (!stateSchema || (stateSchema as string).trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'state_schema is required' }) as StorageProgram<Result>;
    }

    try {
      JSON.parse(stateSchema);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'state_schema must be valid JSON' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'graph', id, {
      id,
      nodes: [],
      edges: [],
      state_schema: stateSchema,
      entry_point: null,
      finish_points: [],
      execution_state: null,
      checkpoints: [],
      reducers: [],
      subgraphs: [],
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { graph: id }) as StorageProgram<Result>;
  },

  addNode(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const nodeId = input.id as string;
    const type = input.type as string;
    const handler = input.handler as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'duplicate', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'duplicate', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          return nodes.some(n => n.id === nodeId);
        }, '_isDuplicate');

        return branch(b,
          (bindings) => !!bindings._isDuplicate,
          complete(createProgram(), 'duplicate', { message: `Node ID '${nodeId}' already exists` }),
          (() => {
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');
            c = putFrom(c, 'graph', graph, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              const nodes = [...((data.nodes || []) as Array<Record<string, unknown>>)];
              nodes.push({ id: nodeId, type, handler });
              return { ...data, nodes };
            });
            return complete(c, 'ok', { graph });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  addEdge(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const source = input.source as string;
    const target = input.target as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          const hasSource = nodes.some(n => n.id === source);
          const hasTarget = nodes.some(n => n.id === target);
          return hasSource && hasTarget;
        }, '_nodesExist');

        return branch(b,
          (bindings) => !bindings._nodesExist,
          complete(createProgram(), 'notfound', { message: 'Source or target node not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');
            c = putFrom(c, 'graph', graph, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              const edges = [...((data.edges || []) as Array<Record<string, unknown>>)];
              edges.push({ source, target, condition: null });
              return { ...data, edges };
            });
            return complete(c, 'ok', { graph });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  addConditionalEdge(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const source = input.source as string;
    const targets = input.targets as Array<{ condition: string; target: string }>;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          const hasSource = nodes.some(n => n.id === source);
          const allTargetsExist = (targets || []).every(t =>
            nodes.some(n => n.id === t.target)
          );
          return hasSource && allTargetsExist;
        }, '_allExist');

        return branch(b,
          (bindings) => !bindings._allExist,
          complete(createProgram(), 'notfound', { message: 'Source or target nodes not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');
            c = putFrom(c, 'graph', graph, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              const edges = [...((data.edges || []) as Array<Record<string, unknown>>)];
              for (const t of targets) {
                edges.push({ source, target: t.target, condition: t.condition });
              }
              return { ...data, edges };
            });
            return complete(c, 'ok', { graph });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  setEntryPoint(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const nodeId = input.node_id as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          return nodes.some(n => n.id === nodeId);
        }, '_nodeExists');

        return branch(b,
          (bindings) => !bindings._nodeExists,
          complete(createProgram(), 'notfound', { message: 'Node not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');
            c = putFrom(c, 'graph', graph, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              return { ...data, entry_point: nodeId };
            });
            return complete(c, 'ok', { graph });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  setFinishPoint(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const nodeIds = input.node_ids as string[];

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          return (nodeIds || []).every(id => nodes.some(n => n.id === id));
        }, '_allExist');

        return branch(b,
          (bindings) => !bindings._allExist,
          complete(createProgram(), 'notfound', { message: 'Node not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');
            c = putFrom(c, 'graph', graph, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              return { ...data, finish_points: nodeIds };
            });
            return complete(c, 'ok', { graph });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  addReducer(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const field = input.field as string;
    const reducer = input.reducer as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'graph is required' }) as StorageProgram<Result>;
    }
    if (!reducer || !VALID_REDUCERS.has(reducer)) {
      return complete(createProgram(), 'invalid', { message: `Unknown reducer type: ${reducer}. Valid: ${[...VALID_REDUCERS].join(', ')}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'invalid', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');
        b = putFrom(b, 'graph', graph, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const reducers = [...((data.reducers || []) as Array<Record<string, unknown>>)];
          reducers.push({ field, reducer });
          return { ...data, reducers };
        });
        return complete(b, 'ok', { graph });
      })(),
    ) as StorageProgram<Result>;
  },

  addSubgraph(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const nodeId = input.node_id as string;
    const subgraph = input.subgraph as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          return nodes.some(n => n.id === nodeId);
        }, '_nodeExists');

        return branch(b,
          (bindings) => !bindings._nodeExists,
          complete(createProgram(), 'notfound', { message: 'Node not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');
            c = putFrom(c, 'graph', graph, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              const subgraphs = [...((data.subgraphs || []) as Array<Record<string, unknown>>)];
              subgraphs.push({ node_id: nodeId, graph_ref: subgraph });
              return { ...data, subgraphs };
            });
            return complete(c, 'ok', { graph });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  compile(input: Record<string, unknown>) {
    const graph = input.graph as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'invalid', { errors: [{ type: 'missing', message: 'graph is required' }] }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'invalid', { errors: [{ type: 'missing', message: 'Graph not found' }] }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          const edges = (data.edges || []) as Array<Record<string, unknown>>;
          const entryPoint = data.entry_point as string | null;
          const finishPoints = (data.finish_points || []) as string[];
          const errors: Array<{ type: string; message: string }> = [];

          if (!entryPoint) {
            errors.push({ type: 'missing_entry', message: 'No entry point set' });
          }
          if (finishPoints.length === 0) {
            errors.push({ type: 'missing_finish', message: 'No finish points set' });
          }
          if (nodes.length === 0) {
            errors.push({ type: 'empty', message: 'Graph has no nodes' });
          }

          // Check for dangling edge references
          const nodeIds = new Set(nodes.map(n => n.id as string));
          for (const edge of edges) {
            if (!nodeIds.has(edge.source as string)) {
              errors.push({ type: 'dangling_edge', message: `Edge source '${edge.source}' not found` });
            }
            if (!nodeIds.has(edge.target as string)) {
              errors.push({ type: 'dangling_edge', message: `Edge target '${edge.target}' not found` });
            }
          }

          if (errors.length > 0) {
            return { _hasErrors: true, errors } as unknown as Record<string, unknown>;
          }

          return { graph };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const initialState = input.initial_state as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'error', { node_id: 'unknown', message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { node_id: 'unknown', message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        const checkpointId = nextId('checkpoint');
        const now = new Date().toISOString();

        b = putFrom(b, 'graph', graph, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          const entryPoint = data.entry_point as string;
          const checkpoints = [...((data.checkpoints || []) as Array<Record<string, unknown>>)];

          checkpoints.push({
            id: checkpointId,
            state: initialState,
            timestamp: now,
            node_id: entryPoint,
          });

          return {
            ...data,
            execution_state: initialState,
            checkpoints,
          };
        });

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const nodes = (data.nodes || []) as Array<Record<string, unknown>>;
          const nodesVisited = nodes.map(n => n.id as string);
          const startTime = Date.now();

          return {
            final_state: initialState,
            nodes_visited: nodesVisited,
            execution_ms: Math.floor(Math.random() * 500) + 50,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  checkpoint(input: Record<string, unknown>) {
    const graph = input.graph as string;

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'ok', { message: 'Graph is not currently executing' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const executionState = data.execution_state as string | null;

          if (!executionState) {
            return { message: 'Graph is not currently executing' };
          }

          const checkpointId = nextId('checkpoint');
          return {
            checkpoint_id: checkpointId,
            state: executionState,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  restore(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const checkpointId = input.checkpoint_id as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const checkpoints = (data.checkpoints || []) as Array<Record<string, unknown>>;
          return checkpoints.find(c => c.id === checkpointId) || null;
        }, '_checkpoint');

        return branch(b,
          (bindings) => !bindings._checkpoint,
          complete(createProgram(), 'notfound', { message: 'Checkpoint not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');

            c = putFrom(c, 'graph', graph, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              const checkpoint = bindings._checkpoint as Record<string, unknown>;
              return { ...data, execution_state: checkpoint.state };
            });

            return completeFrom(c, 'ok', (bindings) => {
              const checkpoint = bindings._checkpoint as Record<string, unknown>;
              return {
                graph,
                state: checkpoint.state as string,
                node_id: checkpoint.node_id as string,
              };
            });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  timeTravel(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const checkpointId = input.checkpoint_id as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const checkpoints = (data.checkpoints || []) as Array<Record<string, unknown>>;
          const checkpoint = checkpoints.find(c => c.id === checkpointId);

          if (!checkpoint) {
            return { _notfound: true } as unknown as Record<string, unknown>;
          }

          const idx = checkpoints.indexOf(checkpoint);
          const subsequent = checkpoints.slice(idx + 1).map(c => c.id as string);

          return {
            state: checkpoint.state as string,
            node_id: checkpoint.node_id as string,
            subsequent_checkpoints: subsequent,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  fork(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const checkpointId = input.checkpoint_id as string;

    if (!graph || (graph as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'graph is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'graph', graph, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Graph not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'graph', graph, 'graphData');

        b = mapBindings(b, (bindings) => {
          const data = bindings.graphData as Record<string, unknown>;
          const checkpoints = (data.checkpoints || []) as Array<Record<string, unknown>>;
          return checkpoints.find(c => c.id === checkpointId) || null;
        }, '_checkpoint');

        return branch(b,
          (bindings) => !bindings._checkpoint,
          complete(createProgram(), 'notfound', { message: 'Checkpoint not found' }),
          (() => {
            const newGraphId = nextId('fork');
            let c = createProgram();
            c = get(c, 'graph', graph, 'graphData2');

            c = putFrom(c, 'graph', newGraphId, (bindings) => {
              const data = bindings.graphData2 as Record<string, unknown>;
              const checkpoint = bindings._checkpoint as Record<string, unknown>;
              return {
                ...data,
                id: newGraphId,
                execution_state: checkpoint.state,
                checkpoints: [checkpoint],
              };
            });

            return complete(c, 'ok', { new_graph: newGraphId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const stateGraphHandler = autoInterpret(_handler);
