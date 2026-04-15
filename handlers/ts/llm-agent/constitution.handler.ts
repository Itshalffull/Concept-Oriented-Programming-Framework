// @clef-handler style=functional
// Constitution Concept Implementation
// Formalized list of ethical, stylistic, or business-logic axioms used during
// Critique-Revision loops to align model behavior. Enables Constitutional AI (CAI)
// and RLAIF.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `constitution-${++idCounter}`;
}

let principleCounter = 0;
function nextPrincipleId(): string {
  return `principle-${++principleCounter}`;
}

const VALID_CATEGORIES = new Set([
  'ethical', 'stylistic', 'safety', 'business_logic', 'factual_grounding',
]);

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Constitution' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const principles = input.principles as Array<{ text: string; category: string; priority: number }>;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!principles || principles.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'No principles provided' }) as StorageProgram<Result>;
    }

    // Validate categories
    for (const p of principles) {
      if (p.category && !VALID_CATEGORIES.has(p.category)) {
        return complete(createProgram(), 'invalid', {
          message: `Unknown category: ${p.category}. Valid: ${[...VALID_CATEGORIES].join(', ')}`,
        }) as StorageProgram<Result>;
      }
    }

    const constitutionId = nextId();
    const indexedPrinciples = principles.map(p => ({
      id: nextPrincipleId(),
      text: p.text,
      category: p.category || 'ethical',
      priority: p.priority || 1,
    }));

    let prog = createProgram();
    prog = put(prog, 'constitution', constitutionId, {
      id: constitutionId,
      name,
      principles: indexedPrinciples,
      revision_config: { max_revisions: 3, critique_model: null },
    });

    return complete(prog, 'ok', { constitution: constitutionId }) as StorageProgram<Result>;
  },

  critique(input: Record<string, unknown>) {
    const constitution = input.constitution as string;
    const response = input.response as string;
    const prompt = input.prompt as string;

    if (!constitution || constitution.trim() === '') {
      return complete(createProgram(), 'error', { message: 'constitution is required' }) as StorageProgram<Result>;
    }
    if (!response || response.trim() === '') {
      return complete(createProgram(), 'error', { message: 'response is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'constitution', constitution, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Constitution not found' }),
      (() => {
        // Evaluate response against principles
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const principles = (existing.principles as Array<Record<string, unknown>>) || [];

          // Simulate critique — check for obvious violations
          const violations: Array<{ principle_id: string; explanation: string; severity: string }> = [];
          const lowerResponse = response.toLowerCase();

          for (const principle of principles) {
            const text = (principle.text as string).toLowerCase();
            // Simple heuristic: if response contains negative keywords related to the principle
            if (text.includes('harmful') && (lowerResponse.includes('harm') || lowerResponse.includes('dangerous'))) {
              violations.push({
                principle_id: principle.id as string,
                explanation: `Response may violate: ${principle.text}`,
                severity: 'high',
              });
            }
          }

          return { violations, hasViolations: violations.length > 0 };
        }, '_critiqueResult');

        return branch(b,
          (bindings) => {
            const result = bindings._critiqueResult as Record<string, unknown>;
            return result.hasViolations === true;
          },
          completeFrom(createProgram(), 'ok', (bindings) => {
            const result = bindings._critiqueResult as Record<string, unknown>;
            const violations = result.violations as Array<Record<string, unknown>>;
            return {
              critique: `Found ${violations.length} violation(s) against constitutional principles.`,
              violations,
            };
          }),
          complete(createProgram(), 'ok', {
            message: 'Response satisfies all principles',
          }),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  revise(input: Record<string, unknown>) {
    const constitution = input.constitution as string;
    const response = input.response as string;
    const critique = input.critique as string;

    if (!constitution || constitution.trim() === '') {
      return complete(createProgram(), 'error', { message: 'constitution is required' }) as StorageProgram<Result>;
    }
    if (!response || response.trim() === '') {
      return complete(createProgram(), 'error', { message: 'response is required' }) as StorageProgram<Result>;
    }
    if (!critique || critique.trim() === '') {
      return complete(createProgram(), 'error', { message: 'critique is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'constitution', constitution, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Constitution not found' }),
      (() => {
        // Generate revised response addressing critique
        const revised = `${response} [Revised to address: ${critique}]`;
        const changes = [{
          principle_id: 'general',
          original: response,
          revised,
        }];

        return complete(createProgram(), 'ok', { revised, changes });
      })(),
    ) as StorageProgram<Result>;
  },

  critiqueAndRevise(input: Record<string, unknown>) {
    const constitution = input.constitution as string;
    const response = input.response as string;
    const prompt = input.prompt as string;

    if (!constitution || constitution.trim() === '') {
      return complete(createProgram(), 'error', { message: 'constitution is required' }) as StorageProgram<Result>;
    }
    if (!response || response.trim() === '') {
      return complete(createProgram(), 'error', { message: 'response is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'constitution', constitution, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Constitution not found' }),
      (() => {
        // Simulate full critique-revision loop
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const config = existing.revision_config as Record<string, unknown>;
          const maxRevisions = (config?.max_revisions as number) || 3;

          const history: Array<{ critique: string; revision: string }> = [];
          let current = response;

          // Simulate one round of critique and revision
          const critiqueText = `Reviewing against constitutional principles`;
          current = `${current} [Aligned with constitution]`;
          history.push({ critique: critiqueText, revision: current });

          return { final: current, rounds: history.length, history };
        }, '_result');

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings._result as Record<string, unknown>;
          return {
            final: result.final,
            rounds: result.rounds,
            history: result.history,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  addPrinciple(input: Record<string, unknown>) {
    const constitution = input.constitution as string;
    const text = input.text as string;
    const category = input.category as string;
    const priority = input.priority as number;

    if (!constitution || constitution.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'constitution is required' }) as StorageProgram<Result>;
    }
    if (!text || text.trim() === '') {
      return complete(createProgram(), 'error', { message: 'text is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'constitution', constitution, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Constitution not found' }),
      (() => {
        const principleId = nextPrincipleId();

        let b = createProgram();
        b = putFrom(b, 'constitution', constitution, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const principles = (existing.principles as Array<Record<string, unknown>>) || [];
          return {
            ...existing,
            principles: [...principles, {
              id: principleId,
              text,
              category: category || 'ethical',
              priority: priority || 1,
            }],
          };
        });

        return complete(b, 'ok', { principle_id: principleId });
      })(),
    ) as StorageProgram<Result>;
  },

  removePrinciple(input: Record<string, unknown>) {
    const constitution = input.constitution as string;
    const principleId = input.principle_id as string;

    if (!constitution || constitution.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'constitution is required' }) as StorageProgram<Result>;
    }
    if (!principleId || principleId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'principle_id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'constitution', constitution, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Constitution not found' }),
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const principles = (existing.principles as Array<Record<string, unknown>>) || [];
          return principles.some(pr => pr.id === principleId);
        }, '_found');

        return branch(b,
          (bindings) => bindings._found !== true,
          complete(createProgram(), 'notfound', { message: `Principle ${principleId} not found` }),
          (() => {
            let b2 = createProgram();
            b2 = putFrom(b2, 'constitution', constitution, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const principles = (existing.principles as Array<Record<string, unknown>>) || [];
              return {
                ...existing,
                principles: principles.filter(pr => pr.id !== principleId),
              };
            });
            return complete(b2, 'ok', { constitution });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'constitution', {}, '_allConstitutions');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allConstitutions as Array<Record<string, unknown>>) ?? [];
      const constitutions = all.filter((rec) => rec.id !== '__registered');
      return { constitutions };
    }) as StorageProgram<Result>;
  },
};

export const constitutionHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetConstitution(): void {
  idCounter = 0;
  principleCounter = 0;
}
