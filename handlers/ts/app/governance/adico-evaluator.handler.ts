// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// AdicoEvaluator Policy Provider
// Parse ADICO grammar (Attributes, Deontic, aIm, Conditions, Or-else) and evaluate deontic rules.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

interface AdicoRule {
  attributes: string;
  deontic: 'must' | 'must not' | 'may' | 'should';
  aim: string;
  conditions: string;
  orElse: string | null;
}

function parseAdico(text: string): AdicoRule | null {
  // Simple structured parser: "A(attributes) D(deontic) I(aim) C(conditions) [O(orElse)]"
  const match = text.match(
    /A\(([^)]*)\)\s*D\(([^)]*)\)\s*I\(([^)]*)\)\s*C\(([^)]*)\)(?:\s*O\(([^)]*)\))?/i,
  );
  if (!match) return null;

  return {
    attributes: match[1].trim(),
    deontic: match[2].trim().toLowerCase() as AdicoRule['deontic'],
    aim: match[3].trim(),
    conditions: match[4].trim(),
    orElse: match[5]?.trim() ?? null,
  };
}

type Result = { variant: string; [key: string]: unknown };

const _adicoEvaluatorHandler: FunctionalConceptHandler = {
  parse(input: Record<string, unknown>) {
    const id = `adico-${Date.now()}`;
    const ruleText = input.ruleText as string;
    const parsed = parseAdico(ruleText);

    if (!parsed) {
      // Allow structured input as fallback
      const structured = typeof input.structured === 'string'
        ? JSON.parse(input.structured)
        : input.structured;

      if (structured) {
        let p = createProgram();
        p = put(p, 'adico', id, {
          id,
          sourceText: ruleText,
          ...structured as Record<string, unknown>,
          parsedAt: new Date().toISOString(),
        });
        return complete(p, 'ok', { rule: id }) as StorageProgram<Result>;
      }
      return complete(createProgram(), 'parse_error', { sourceText: ruleText }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, 'adico', id, {
      id,
      sourceText: ruleText,
      attributes: parsed.attributes,
      deontic: parsed.deontic,
      aim: parsed.aim,
      conditions: parsed.conditions,
      orElse: parsed.orElse,
      parsedAt: new Date().toISOString(),
    });

    p = put(p, 'plugin-registry', `policy-evaluator:${id}`, {
      id: `policy-evaluator:${id}`,
      pluginKind: 'policy-evaluator',
      provider: 'AdicoEvaluator',
      instanceId: id,
    });

    return complete(p, 'ok', { rule: id }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { rule, context } = input;
    let p = createProgram();
    p = get(p, 'adico', rule as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'evaluated', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const ctx = (typeof context === 'string' ? JSON.parse(context) : context) as Record<string, unknown>;
          const attributes = record.attributes as string;
          const deontic = record.deontic as string;
          const aim = record.aim as string;
          const conditions = record.conditions as string;

          // Check if actor matches attributes
          const actor = ctx.actor as string | undefined;
          const actorRole = ctx.role as string | undefined;
          const attributeMatch = !attributes || attributes === '*' ||
            actor === attributes || actorRole === attributes;

          if (!attributeMatch) return { variant: 'not_applicable', rule, reason: 'actor mismatch' };

          // Check if action matches aim
          const action = ctx.action as string | undefined;
          const aimMatch = !aim || aim === '*' || action === aim;

          if (!aimMatch) return { variant: 'not_applicable', rule, reason: 'aim mismatch' };

          // Check conditions
          const conditionMet = !conditions || conditions === '*' || conditions === 'always' ||
            ctx[conditions] === true;

          if (!conditionMet) return { variant: 'not_applicable', rule, reason: 'conditions not met' };

          // Apply deontic evaluation
          switch (deontic) {
            case 'must':
              return { variant: 'obligated', rule, aim, orElse: record.orElse };
            case 'must not':
              return { variant: 'forbidden', rule, aim, orElse: record.orElse };
            case 'may':
              return { variant: 'permitted', rule, aim };
            case 'should':
              return { variant: 'recommended', rule, aim };
            default:
              return { variant: 'permitted', rule, aim };
          }
        });
      },
      (elseP) => complete(elseP, 'not_found', { rule }),
    ) as StorageProgram<Result>;
  },
};

export const adicoEvaluatorHandler = autoInterpret(_adicoEvaluatorHandler);
