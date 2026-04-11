// ActionType handler — functional StorageProgram style
// Classifies action interactions by semantic purpose (invoke, commit, trigger).
// The action-domain counterpart to Interactor, which classifies field interactions.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Built-in action type seeds — registered on first classify() if no types are stored.
// Callers may also call define() explicitly to register custom types.
const BUILTIN_TYPES = [
  {
    actionType: 'invoke',
    name: 'invoke',
    properties: JSON.stringify({
      semantics: 'one-shot',
      reversibility: 'irreversible',
      async: false,
      examples: ['button', 'menu-item', 'toolbar-action', 'swipe', 'context-menu', 'slash-command', 'keyboard-shortcut'],
    }),
  },
  {
    actionType: 'commit',
    name: 'commit',
    properties: JSON.stringify({
      semantics: 'finalize',
      reversibility: 'irreversible',
      async: false,
      examples: ['form-submit', 'save'],
    }),
  },
  {
    actionType: 'trigger',
    name: 'trigger',
    properties: JSON.stringify({
      semantics: 'fire-and-forget',
      reversibility: 'irreversible',
      async: true,
      examples: ['background-process', 'long-running-job'],
    }),
  },
];

/**
 * Determine the best-matching action type from variant set and context.
 * Returns { actionType, confidence } pairs sorted by confidence descending.
 */
function scoreTypes(
  allTypes: Record<string, unknown>[],
  parsedVariants: string[],
  parsedContext: Record<string, unknown>,
): Array<{ actionType: string; confidence: number }> {
  const isAsync = parsedContext.async === true;
  const isFormFlow = parsedContext.formFlow === true || parsedContext.form === true;
  const hasOnlyOkAndError = parsedVariants.length <= 2
    && parsedVariants.includes('ok')
    && parsedVariants.every((v) => v === 'ok' || v === 'error');
  const hasInvalidVariant = parsedVariants.includes('invalid');

  const results: Array<{ actionType: string; confidence: number }> = [];

  for (const entry of allTypes) {
    const id = entry.actionType as string;
    let props: Record<string, unknown> = {};
    try {
      props = JSON.parse(entry.properties as string);
    } catch {
      props = {};
    }

    let confidence = 0;

    if (id === 'trigger' || props.async === true) {
      if (isAsync) confidence += 0.6;
      else confidence -= 0.2;
    }

    if (id === 'commit' || props.semantics === 'finalize') {
      if (isFormFlow) confidence += 0.5;
      if (hasInvalidVariant) confidence += 0.2;
      if (isAsync) confidence -= 0.3;
    }

    if (id === 'invoke' || props.semantics === 'one-shot') {
      if (hasOnlyOkAndError && !isFormFlow && !isAsync) confidence += 0.4;
      else if (!isFormFlow && !isAsync) confidence += 0.2;
    }

    if (confidence > 0) {
      results.push({ actionType: id, confidence: Math.min(confidence, 1.0) });
    }
  }

  if (results.length === 0) {
    // Default to invoke when no signal matches
    results.push({ actionType: 'invoke', confidence: 0.5 });
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

const _handler: FunctionalConceptHandler = {

  register() {
    return { name: 'ActionType' };
  },

  define(input: Record<string, unknown>) {
    const actionType = input.actionType as string;
    const name = input.name as string;
    const properties = (input.properties as string) || '{}';

    // Validate required fields
    if (!actionType || actionType.trim() === '') {
      return complete(createProgram(), 'duplicate', {
        message: 'actionType identifier is required',
      }) as StorageProgram<Result>;
    }
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'duplicate', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    // Validate properties is valid JSON
    try {
      JSON.parse(properties);
    } catch {
      return complete(createProgram(), 'duplicate', {
        message: 'properties must be valid JSON',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'actionType', actionType, 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'duplicate', {
        message: `Action type '${actionType}' already exists`,
      }),
      (elseP) => {
        elseP = put(elseP, 'actionType', actionType, {
          actionType,
          name,
          properties,
        });
        return complete(elseP, 'ok', { actionType });
      },
    ) as StorageProgram<Result>;
  },

  classify(input: Record<string, unknown>) {
    const _target = input.target as string;
    const variants = (input.variants as string) || '[]';
    const context = (input.context as string) || '{}';

    let parsedVariants: string[] = [];
    let parsedContext: Record<string, unknown> = {};

    try {
      parsedVariants = JSON.parse(variants);
    } catch {
      return complete(createProgram(), 'ambiguous', {
        actionType: 'invoke',
        candidates: '[]',
      }) as StorageProgram<Result>;
    }

    try {
      parsedContext = JSON.parse(context);
    } catch {
      return complete(createProgram(), 'ambiguous', {
        actionType: 'invoke',
        candidates: '[]',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'actionType', {}, 'allTypes');

    return completeFrom(p, 'dynamic', (bindings) => {
      let allTypes = bindings.allTypes as Record<string, unknown>[];

      // Seed built-ins if nothing is registered yet
      if (!allTypes || allTypes.length === 0) {
        allTypes = BUILTIN_TYPES;
      }

      const scored = scoreTypes(allTypes, parsedVariants, parsedContext);

      if (scored.length === 0) {
        return {
          variant: 'ok',
          actionType: 'invoke',
          confidence: 0.5,
        };
      }

      const top = scored[0];
      const second = scored[1];

      // Ambiguous if top two are within 0.05 of each other
      if (second && Math.abs(top.confidence - second.confidence) <= 0.05) {
        return {
          variant: 'ambiguous',
          actionType: top.actionType,
          candidates: JSON.stringify(scored),
        };
      }

      return {
        variant: 'ok',
        actionType: top.actionType,
        confidence: top.confidence,
      };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const actionType = input.actionType as string;

    if (!actionType) {
      return complete(createProgram(), 'notfound', {
        message: 'actionType is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'actionType', actionType, 'existing');

    return branch(p, 'existing',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return {
          actionType: existing.actionType as string,
          name: existing.name as string,
          properties: existing.properties as string,
        };
      }),
      (elseP) => complete(elseP, 'notfound', {
        message: `Action type '${actionType}' not found`,
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'actionType', {}, 'allTypes');

    return completeFrom(p, 'ok', (bindings) => {
      const allTypes = bindings.allTypes as Record<string, unknown>[];
      const result = (allTypes || []).map((entry) => ({
        actionType: entry.actionType,
        name: entry.name,
      }));
      return { actionTypes: JSON.stringify(result) };
    }) as StorageProgram<Result>;
  },
};

export const actionTypeHandler = autoInterpret(_handler);
