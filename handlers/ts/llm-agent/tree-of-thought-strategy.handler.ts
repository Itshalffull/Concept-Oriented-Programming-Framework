// @clef-handler style=functional
// TreeOfThoughtStrategy Concept Implementation
// Tree-of-Thought strategy provider. Explores multiple reasoning paths in parallel,
// evaluates each branch, prunes unpromising paths, and selects the best.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `tot-session-${++idCounter}`;
}

let nodeCounter = 0;
function nextNodeId(): string {
  return `node-${++nodeCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'TreeOfThoughtStrategy' }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const agentRef = input.agent_ref as string;
    const goal = input.goal as string;
    const context = input.context as string;
    const maxIterations = input.max_iterations as number;

    if (!agentRef || agentRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'agent_ref is required' }) as StorageProgram<Result>;
    }
    if (!goal || goal.trim() === '') {
      return complete(createProgram(), 'error', { message: 'goal is required' }) as StorageProgram<Result>;
    }

    const sessionId = nextId();
    const beamWidth = 3;

    // Build a simple thought tree
    const rootId = nextNodeId();
    const tree = [
      { node_id: rootId, parent_id: null, thought: `Root: ${goal}`, score: 1.0, status: 'expanded' },
    ];

    // Branch: generate candidates
    const candidates = [];
    for (let i = 0; i < beamWidth; i++) {
      const nid = nextNodeId();
      const score = 0.9 - i * 0.15;
      candidates.push({
        node_id: nid,
        parent_id: rootId,
        thought: `Approach ${i + 1} for: ${goal}`,
        score,
        status: score > 0.7 ? 'selected' : 'pruned',
      });
      tree.push(candidates[candidates.length - 1]);
    }

    // Select best path
    const bestPath = tree
      .filter(n => n.status !== 'pruned' && n.score !== null)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map(n => ({ thought: n.thought, score: n.score as number }));

    let p = createProgram();
    p = put(p, 'session', sessionId, {
      id: sessionId,
      agent_ref: agentRef,
      thought_tree: tree,
      beam_width: beamWidth,
      evaluation_prompt: null,
    });

    return complete(p, 'ok', {
      result: `Tree-of-Thought completed for: ${goal}`,
      branches_explored: tree.length,
      best_path: bestPath,
    }) as StorageProgram<Result>;
  },

  branch(input: Record<string, unknown>) {
    const session = input.session as string;
    const parentId = input.parent_id as string;
    const numCandidates = input.num_candidates as number;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!parentId || parentId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'parent_id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        const count = numCandidates || 3;
        const candidates = [];
        for (let i = 0; i < count; i++) {
          candidates.push({
            node_id: nextNodeId(),
            thought: `Candidate ${i + 1} from parent ${parentId}`,
          });
        }

        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const tree = (existing.thought_tree as Array<Record<string, unknown>>) || [];
          const newNodes = candidates.map(c => ({
            ...c,
            parent_id: parentId,
            score: null,
            status: 'pending',
          }));
          return { ...existing, thought_tree: [...tree, ...newNodes] };
        });

        return complete(b, 'ok', { candidates });
      })(),
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const session = input.session as string;
    const nodeIds = input.node_ids as string[];

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!nodeIds || nodeIds.length === 0) {
      return complete(createProgram(), 'error', { message: 'node_ids is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        // Score each node (simulated evaluation)
        const scores = nodeIds.map((nid, i) => ({
          node_id: nid,
          score: Math.max(0.3, 0.95 - i * 0.1),
        }));

        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const tree = (existing.thought_tree as Array<Record<string, unknown>>) || [];
          const scoreMap = new Map(scores.map(s => [s.node_id, s.score]));
          const updatedTree = tree.map(node => {
            const nid = node.node_id as string;
            if (scoreMap.has(nid)) {
              return { ...node, score: scoreMap.get(nid), status: 'evaluated' };
            }
            return node;
          });
          return { ...existing, thought_tree: updatedTree };
        });

        return complete(b, 'ok', { scores });
      })(),
    ) as StorageProgram<Result>;
  },

  prune(input: Record<string, unknown>) {
    const session = input.session as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const tree = (existing.thought_tree as Array<Record<string, unknown>>) || [];
          const beamWidth = (existing.beam_width as number) || 3;

          // Sort evaluated nodes by score, prune those below beam_width
          const evaluated = tree.filter(n => n.status === 'evaluated');
          const sorted = [...evaluated].sort((a, b) => ((b.score as number) || 0) - ((a.score as number) || 0));
          const keepIds = new Set(sorted.slice(0, beamWidth).map(n => n.node_id));
          const pruned = evaluated.length - keepIds.size;
          return { pruned, remaining: keepIds.size };
        }, '_pruneResult');

        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const tree = (existing.thought_tree as Array<Record<string, unknown>>) || [];
          const beamWidth = (existing.beam_width as number) || 3;
          const evaluated = tree.filter(n => n.status === 'evaluated');
          const sorted = [...evaluated].sort((a, b) => ((b.score as number) || 0) - ((a.score as number) || 0));
          const keepIds = new Set(sorted.slice(0, beamWidth).map(n => n.node_id));
          const updatedTree = tree.map(node => {
            if (node.status === 'evaluated' && !keepIds.has(node.node_id as string)) {
              return { ...node, status: 'pruned' };
            }
            return node;
          });
          return { ...existing, thought_tree: updatedTree };
        });

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings._pruneResult as Record<string, unknown>;
          return { pruned: result.pruned, remaining: result.remaining };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  getState(input: Record<string, unknown>) {
    const session = input.session as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      completeFrom(createProgram(), 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return { tree: existing.thought_tree || [] };
      }),
    ) as StorageProgram<Result>;
  },
};

export const treeOfThoughtStrategyHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetTreeOfThoughtStrategy(): void {
  idCounter = 0;
  nodeCounter = 0;
}
