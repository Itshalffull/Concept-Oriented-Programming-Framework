// @clef-handler style=functional
// BrainstormBoard Concept Implementation
// Manages the lifecycle of a brainstorm step inside a governance process run:
// submit phase (ideas added), shortlist phase (facilitator marks ideas), closed phase (output produced).
// Ideas are ContentNode refs — content ownership stays with ContentNode.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `bb-${Date.now()}-${++idCounter}`;
}

const handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'brainstorm-board', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'BrainstormBoard' }),
      (b) => {
        let b2 = put(b, 'brainstorm-board', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'BrainstormBoard' });
      },
    ) as StorageProgram<Result>;
  },

  open(input: Record<string, unknown>) {
    const stepRef = input.step_ref as string;
    const anonymous = input.anonymous as boolean;
    const shortlistSize = input.shortlist_size as number;

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }
    if (!shortlistSize || shortlistSize < 1) {
      return complete(createProgram(), 'error', { message: 'shortlist_size must be at least 1' }) as StorageProgram<Result>;
    }

    // Idempotency: check if a board for this step_ref already exists
    let p = createProgram();
    p = get(p, 'brainstorm-board-by-step', stepRef, 'existingIndex');
    return branch(p, 'existingIndex',
      // Already exists — return the existing board id
      (b) => completeFrom(b, 'ok', (bindings) => {
        const idx = bindings.existingIndex as Record<string, unknown>;
        return { board: idx.board_id as string };
      }),
      // New board
      (b) => {
        const id = nextId();
        let b2 = put(b, 'brainstorm-board', id, {
          id,
          step_ref: stepRef,
          phase: 'submit',
          anonymous: anonymous ?? false,
          shortlist_size: shortlistSize,
          ideas: [],
          submitters: [],
          endorsements: [],
          forks: [],
          fork_parents: [],
          shortlisted: [],
          output: null,
        });
        b2 = put(b2, 'brainstorm-board-by-step', stepRef, { board_id: id });
        return complete(b2, 'ok', { board: id });
      },
    ) as StorageProgram<Result>;
  },

  submitIdea(input: Record<string, unknown>) {
    const boardId = input.board as string;
    const ideaRef = input.idea_ref as string;
    const submitterRef = input.submitter_ref as string;

    if (!ideaRef || ideaRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'idea_ref is required' }) as StorageProgram<Result>;
    }
    if (!submitterRef || submitterRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'submitter_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'brainstorm-board', boardId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return (rec.phase as string) !== 'submit';
          },
          // Not in submit phase — locked
          (b2) => complete(b2, 'locked', { message: 'Board is not in submit phase; ideas may not be submitted' }),
          // In submit phase — append idea
          (b2) => {
            let b3 = putFrom(b2, 'brainstorm-board', boardId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              const ideas = [...(rec.ideas as string[])];
              const submitters = [...(rec.submitters as string[])];
              const endorsements = [...(rec.endorsements as number[])];
              ideas.push(ideaRef);
              submitters.push(submitterRef);
              endorsements.push(0);
              return { ...rec, ideas, submitters, endorsements };
            });
            return complete(b3, 'ok', { board: boardId, idea_ref: ideaRef });
          },
        );
      },
      (b) => complete(b, 'not_found', { message: `No brainstorm board found with id: ${boardId}` }),
    ) as StorageProgram<Result>;
  },

  forkIdea(input: Record<string, unknown>) {
    const boardId = input.board as string;
    const parentIdeaRef = input.parent_idea_ref as string;
    const forkIdeaRef = input.fork_idea_ref as string;
    const submitterRef = input.submitter_ref as string;

    if (!forkIdeaRef || forkIdeaRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'fork_idea_ref is required' }) as StorageProgram<Result>;
    }
    if (!submitterRef || submitterRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'submitter_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'brainstorm-board', boardId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return (rec.phase as string) !== 'submit';
          },
          // Not in submit phase — locked
          (b2) => complete(b2, 'locked', { message: 'Board is not in submit phase; forking is not permitted' }),
          // In submit phase — check parent exists
          (b2) => {
            return branch(b2,
              (bindings) => {
                const rec = bindings.existing as Record<string, unknown>;
                const ideas = rec.ideas as string[];
                return !ideas.includes(parentIdeaRef);
              },
              // Parent not found
              (b3) => complete(b3, 'not_found', { message: `Parent idea ref not found in board: ${parentIdeaRef}` }),
              // Parent found — insert fork after parent
              (b3) => {
                let b4 = putFrom(b3, 'brainstorm-board', boardId, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const ideas = [...(rec.ideas as string[])];
                  const submitters = [...(rec.submitters as string[])];
                  const endorsements = [...(rec.endorsements as number[])];
                  const forks = [...(rec.forks as string[])];
                  const forkParents = [...(rec.fork_parents as string[])];

                  // Insert fork after parent in ideas list
                  const parentIdx = ideas.indexOf(parentIdeaRef);
                  ideas.splice(parentIdx + 1, 0, forkIdeaRef);
                  submitters.splice(parentIdx + 1, 0, submitterRef);
                  endorsements.splice(parentIdx + 1, 0, 0);

                  forks.push(forkIdeaRef);
                  forkParents.push(parentIdeaRef);

                  return { ...rec, ideas, submitters, endorsements, forks, fork_parents: forkParents };
                });
                return complete(b4, 'ok', { board: boardId, fork_idea_ref: forkIdeaRef });
              },
            );
          },
        );
      },
      (b) => complete(b, 'not_found', { message: `No brainstorm board found with id: ${boardId}` }),
    ) as StorageProgram<Result>;
  },

  endorseIdea(input: Record<string, unknown>) {
    const boardId = input.board as string;
    const ideaRef = input.idea_ref as string;

    let p = createProgram();
    p = get(p, 'brainstorm-board', boardId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return (rec.phase as string) === 'closed';
          },
          // Closed phase — locked
          (b2) => complete(b2, 'locked', { message: 'Board is closed; endorsements are no longer accepted' }),
          // submit or shortlist — check idea exists
          (b2) => {
            return branch(b2,
              (bindings) => {
                const rec = bindings.existing as Record<string, unknown>;
                const ideas = rec.ideas as string[];
                return !ideas.includes(ideaRef);
              },
              // Idea not found
              (b3) => complete(b3, 'not_found', { message: `Idea ref not found in board: ${ideaRef}` }),
              // Idea found — increment endorsement
              (b3) => {
                let endorsementCount = 0;
                let b4 = putFrom(b3, 'brainstorm-board', boardId, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const ideas = rec.ideas as string[];
                  const endorsements = [...(rec.endorsements as number[])];
                  const idx = ideas.indexOf(ideaRef);
                  endorsements[idx] = (endorsements[idx] ?? 0) + 1;
                  endorsementCount = endorsements[idx];
                  return { ...rec, endorsements };
                });
                return completeFrom(b4, 'ok', (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const ideas = rec.ideas as string[];
                  const endorsements = rec.endorsements as number[];
                  const idx = ideas.indexOf(ideaRef);
                  const count = (endorsements[idx] ?? 0) + 1;
                  return { board: boardId, idea_ref: ideaRef, endorsements: count };
                });
              },
            );
          },
        );
      },
      (b) => complete(b, 'not_found', { message: `No brainstorm board found with id: ${boardId}` }),
    ) as StorageProgram<Result>;
  },

  closeSubmission(input: Record<string, unknown>) {
    const boardId = input.board as string;

    let p = createProgram();
    p = get(p, 'brainstorm-board', boardId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return (rec.phase as string) !== 'submit';
          },
          // Already in shortlist or closed phase
          (b2) => complete(b2, 'already_closed', { message: 'Board is already past the submit phase' }),
          // In submit phase — compute auto-shortlist and transition
          (b2) => {
            let b3 = putFrom(b2, 'brainstorm-board', boardId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              const ideas = rec.ideas as string[];
              const endorsements = rec.endorsements as number[];
              const shortlistSize = rec.shortlist_size as number;

              // Build index-sorted pairs: [ideaRef, endorsementCount]
              const indexed = ideas.map((ref, i) => ({ ref, count: endorsements[i] ?? 0 }));
              // Sort descending by endorsement count
              indexed.sort((a, b) => b.count - a.count);
              // Take top N
              const shortlisted = indexed.slice(0, shortlistSize).map((x) => x.ref);

              return { ...rec, phase: 'shortlist', shortlisted };
            });
            return complete(b3, 'ok', { board: boardId });
          },
        );
      },
      (b) => complete(b, 'not_found', { message: `No brainstorm board found with id: ${boardId}` }),
    ) as StorageProgram<Result>;
  },

  shortlist(input: Record<string, unknown>) {
    const boardId = input.board as string;
    const ideaRefsJson = input.idea_refs as string;

    // Parse JSON first (before any storage access)
    let ideaRefs: string[];
    try {
      ideaRefs = JSON.parse(ideaRefsJson);
      if (!Array.isArray(ideaRefs)) {
        return complete(createProgram(), 'error', { message: 'idea_refs must be a JSON array of strings' }) as StorageProgram<Result>;
      }
    } catch {
      return complete(createProgram(), 'error', { message: 'idea_refs is not valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'brainstorm-board', boardId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return (rec.phase as string) !== 'shortlist';
          },
          // Not in shortlist phase
          (b2) => complete(b2, 'locked', { message: 'Board is not in shortlist phase; call closeSubmission first' }),
          // In shortlist phase — validate all refs exist in ideas
          (b2) => {
            return branch(b2,
              (bindings) => {
                const rec = bindings.existing as Record<string, unknown>;
                const ideas = rec.ideas as string[];
                return !ideaRefs.every((ref) => ideas.includes(ref));
              },
              // Some refs not in ideas
              (b3) => complete(b3, 'error', { message: 'idea_refs contains refs not present in the board ideas list' }),
              // All valid — override shortlist
              (b3) => {
                let b4 = putFrom(b3, 'brainstorm-board', boardId, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  return { ...rec, shortlisted: ideaRefs };
                });
                return complete(b4, 'ok', { board: boardId });
              },
            );
          },
        );
      },
      (b) => complete(b, 'not_found', { message: `No brainstorm board found with id: ${boardId}` }),
    ) as StorageProgram<Result>;
  },

  close(input: Record<string, unknown>) {
    const boardId = input.board as string;

    let p = createProgram();
    p = get(p, 'brainstorm-board', boardId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return (rec.phase as string) !== 'shortlist';
          },
          // Not in shortlist phase
          (b2) => complete(b2, 'locked', { message: 'Board is not in shortlist phase; call closeSubmission before close' }),
          // In shortlist phase — serialize and close
          (b2) => {
            let b3 = putFrom(b2, 'brainstorm-board', boardId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              const shortlisted = rec.shortlisted as string[];
              const output = JSON.stringify(shortlisted);
              return { ...rec, phase: 'closed', output };
            });
            return completeFrom(b3, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              const shortlisted = rec.shortlisted as string[];
              return { board: boardId, output: JSON.stringify(shortlisted) };
            });
          },
        );
      },
      (b) => complete(b, 'not_found', { message: `No brainstorm board found with id: ${boardId}` }),
    ) as StorageProgram<Result>;
  },

  getIdeas(input: Record<string, unknown>) {
    const boardId = input.board as string;

    let p = createProgram();
    p = get(p, 'brainstorm-board', boardId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const ideas = rec.ideas as string[];
          const submitters = rec.submitters as string[];
          const endorsements = rec.endorsements as number[];
          const forks = rec.forks as string[];
          const phase = rec.phase as string;
          const anonymous = rec.anonymous as boolean;

          const isClosed = phase === 'closed';

          const result = ideas.map((ideaRef, i) => ({
            idea_ref: ideaRef,
            submitter_ref: (anonymous && !isClosed) ? null : (submitters[i] ?? null),
            endorsements: endorsements[i] ?? 0,
            is_fork: forks.includes(ideaRef),
            parent_ref: forks.includes(ideaRef)
              ? (rec.fork_parents as string[])[forks.indexOf(ideaRef)] ?? null
              : null,
          }));

          return { board: boardId, ideas: JSON.stringify(result), phase };
        });
      },
      (b) => complete(b, 'not_found', { message: `No brainstorm board found with id: ${boardId}` }),
    ) as StorageProgram<Result>;
  },
};

export const brainstormBoardHandler = autoInterpret(handler);
