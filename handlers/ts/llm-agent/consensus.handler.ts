// @clef-handler style=functional
// Consensus Concept Implementation
// Multi-agent decision-making when agents produce contradictory results or propose
// incompatible strategies. Supports voting, confidence-based resolution, and
// iterative refinement.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `consensus-${++idCounter}`;
}

const VALID_METHODS = new Set([
  'simple_majority', 'weighted', 'unanimous', 'supermajority',
  'confidence_based', 'iterative_refinement',
]);

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Consensus' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const proposal = input.proposal as string;
    const method = input.method as string;
    const maxRounds = input.max_rounds as number;

    if (!proposal || proposal.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'proposal is required' }) as StorageProgram<Result>;
    }
    if (!method || !VALID_METHODS.has(method)) {
      return complete(createProgram(), 'invalid', { message: `Unknown method: ${method}. Valid: ${[...VALID_METHODS].join(', ')}` }) as StorageProgram<Result>;
    }

    const sessionId = nextId();

    let p = createProgram();
    p = put(p, 'session', sessionId, {
      id: sessionId,
      proposal,
      votes: [],
      method,
      max_rounds: maxRounds || 3,
      current_round: 1,
      agent_weights: [],
      outcome: null,
    });

    return complete(p, 'ok', { session: sessionId }) as StorageProgram<Result>;
  },

  vote(input: Record<string, unknown>) {
    const session = input.session as string;
    const agentId = input.agent_id as string;
    const position = input.position as string;
    const confidence = input.confidence as number;
    const reasoning = input.reasoning as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!agentId || agentId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'agent_id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        // Check if agent already voted this round
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const votes = (existing.votes as Array<Record<string, unknown>>) || [];
          const currentRound = existing.current_round as number;
          return votes.some(v => v.agent_id === agentId && v.round === currentRound);
        }, '_alreadyVoted');

        return branch(b,
          (bindings) => bindings._alreadyVoted === true,
          complete(createProgram(), 'ok', { message: `Agent ${agentId} already voted this round` }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'session', session, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const votes = (existing.votes as Array<Record<string, unknown>>) || [];
              const currentRound = existing.current_round as number;
              return {
                ...existing,
                votes: [...votes, {
                  agent_id: agentId,
                  position,
                  confidence: Math.max(0, Math.min(1, confidence || 0.5)),
                  reasoning: reasoning || '',
                  round: currentRound,
                }],
              };
            });
            return complete(b2, 'ok', { session });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  tally(input: Record<string, unknown>) {
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
          const votes = (existing.votes as Array<Record<string, unknown>>) || [];
          const method = existing.method as string;
          const agentWeights = (existing.agent_weights as Array<Record<string, unknown>>) || [];
          const weightMap = new Map(agentWeights.map(w => [w.agent_id as string, w.weight as number]));

          // Group by position
          const positionMap = new Map<string, { votes: number; weightedScore: number }>();
          for (const vote of votes) {
            const pos = vote.position as string;
            const conf = vote.confidence as number;
            const aid = vote.agent_id as string;
            const weight = weightMap.get(aid) || 1.0;
            const entry = positionMap.get(pos) || { votes: 0, weightedScore: 0 };
            entry.votes++;
            entry.weightedScore += conf * weight;
            positionMap.set(pos, entry);
          }

          const breakdown = [...positionMap.entries()].map(([pos, data]) => ({
            position: pos,
            votes: data.votes,
            weighted_score: data.weightedScore,
          })).sort((a, b) => b.weighted_score - a.weighted_score);

          // Determine winner based on method
          let decision: string | null = null;
          if (breakdown.length > 0) {
            if (method === 'unanimous') {
              decision = breakdown.length === 1 ? breakdown[0].position : null;
            } else if (method === 'supermajority') {
              const total = votes.length;
              decision = breakdown[0].votes / total >= 2 / 3 ? breakdown[0].position : null;
            } else {
              // simple_majority, weighted, confidence_based
              decision = breakdown[0].position;
            }
          }

          return { decision, voteCount: votes.length, breakdown };
        }, '_tallyResult');

        return branch(b,
          (bindings) => {
            const result = bindings._tallyResult as Record<string, unknown>;
            return result.decision != null;
          },
          completeFrom(createProgram(), 'ok', (bindings) => {
            const result = bindings._tallyResult as Record<string, unknown>;
            return {
              decision: result.decision,
              vote_count: result.voteCount,
              breakdown: result.breakdown,
            };
          }),
          completeFrom(createProgram(), 'ok', (bindings) => {
            const result = bindings._tallyResult as Record<string, unknown>;
            const breakdown = result.breakdown as Array<Record<string, unknown>>;
            return {
              positions: breakdown.map(b => ({
                position: b.position,
                votes: b.votes,
              })),
            };
          }),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const session = input.session as string;
    const agentId = input.agent_id as string;
    const counterArgument = input.counter_argument as string;

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
          const currentRound = existing.current_round as number;
          const maxRounds = existing.max_rounds as number;
          return { currentRound, maxRounds, hitMax: currentRound >= maxRounds };
        }, '_roundInfo');

        return branch(b,
          (bindings) => {
            const info = bindings._roundInfo as Record<string, unknown>;
            return info.hitMax === true;
          },
          (() => {
            // Hit max rounds — return best position
            let b2 = createProgram();
            b2 = mapBindings(b2, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const votes = (existing.votes as Array<Record<string, unknown>>) || [];
              // Find position with highest total confidence
              const posScores = new Map<string, number>();
              for (const v of votes) {
                const pos = v.position as string;
                posScores.set(pos, (posScores.get(pos) || 0) + (v.confidence as number));
              }
              let bestPos = '';
              let bestScore = -1;
              for (const [pos, score] of posScores) {
                if (score > bestScore) {
                  bestPos = pos;
                  bestScore = score;
                }
              }
              return bestPos;
            }, '_bestPosition');

            return completeFrom(b2, 'ok', (bindings) => ({
              best_position: bindings._bestPosition as string,
            }));
          })(),
          (() => {
            // Start new round
            let b2 = createProgram();
            b2 = putFrom(b2, 'session', session, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const currentRound = existing.current_round as number;
              return { ...existing, current_round: currentRound + 1 };
            });

            return completeFrom(b2, 'ok', (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const currentRound = existing.current_round as number;
              return { new_round: currentRound + 1 };
            });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
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
          const votes = (existing.votes as Array<Record<string, unknown>>) || [];
          const method = existing.method as string;

          if (votes.length === 0) {
            return { hasDecision: false, positions: [] as string[] };
          }

          // Find highest-confidence position
          const posConfidence = new Map<string, { totalConf: number; count: number }>();
          for (const v of votes) {
            const pos = v.position as string;
            const conf = v.confidence as number;
            const entry = posConfidence.get(pos) || { totalConf: 0, count: 0 };
            entry.totalConf += conf;
            entry.count++;
            posConfidence.set(pos, entry);
          }

          let bestPos = '';
          let bestConf = -1;
          for (const [pos, data] of posConfidence) {
            const avgConf = data.totalConf / data.count;
            if (avgConf > bestConf) {
              bestPos = pos;
              bestConf = avgConf;
            }
          }

          return { hasDecision: true, decision: bestPos, confidence: bestConf, method };
        }, '_resolveResult');

        return branch(b,
          (bindings) => {
            const result = bindings._resolveResult as Record<string, unknown>;
            return result.hasDecision === true;
          },
          completeFrom(createProgram(), 'ok', (bindings) => {
            const result = bindings._resolveResult as Record<string, unknown>;
            return {
              decision: result.decision,
              confidence: result.confidence,
              method: result.method,
            };
          }),
          completeFrom(createProgram(), 'ok', (bindings) => {
            const result = bindings._resolveResult as Record<string, unknown>;
            return { positions: result.positions };
          }),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  setWeight(input: Record<string, unknown>) {
    const session = input.session as string;
    const agentId = input.agent_id as string;
    const weight = input.weight as number;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!agentId || agentId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'agent_id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Session not found' }),
      (() => {
        // Check if agent has voted (is participating)
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const votes = (existing.votes as Array<Record<string, unknown>>) || [];
          return votes.some(v => v.agent_id === agentId);
        }, '_isParticipant');

        return branch(b,
          (bindings) => bindings._isParticipant !== true,
          complete(createProgram(), 'notfound', { message: `Agent ${agentId} not participating` }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'session', session, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const weights = (existing.agent_weights as Array<Record<string, unknown>>) || [];
              const filtered = weights.filter(w => w.agent_id !== agentId);
              return {
                ...existing,
                agent_weights: [...filtered, { agent_id: agentId, weight: weight || 1.0 }],
              };
            });
            return complete(b2, 'ok', { session });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const consensusHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetConsensus(): void {
  idCounter = 0;
}
