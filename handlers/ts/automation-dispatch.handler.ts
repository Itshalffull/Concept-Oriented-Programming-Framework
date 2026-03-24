// @clef-handler style=functional
// ============================================================
// AutomationDispatch Handler
//
// Routes automation execution requests to registered provider
// backends. Reads provider name and delegates to the matching
// provider via PluginRegistry lookup.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `dispatch-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  dispatch(input: Record<string, unknown>) {
    const ruleRef = (input.rule_ref as string) || '';
    const providerName = (input.provider_name as string) || '';
    const context = (input.context as string) || '{}';

    if (!ruleRef || ruleRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'rule_ref is required' }) as StorageProgram<Result>;
    }
    if (!providerName || providerName.trim() === '') {
      return complete(createProgram(), 'notfound', { provider_name: providerName }) as StorageProgram<Result>;
    }

    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context);
    } catch {
      parsedContext = {};
    }

    // Check if provider is registered
    let p = createProgram();
    p = get(p, 'automation-provider-registry', providerName, 'providerRec');

    return branch(p, 'providerRec',
      (b) => {
        // Provider found — record the dispatch and complete
        const id = nextId();
        const now = new Date().toISOString();
        const result = JSON.stringify({
          provider: providerName,
          rule: ruleRef,
          context: parsedContext,
          dispatched_at: now,
          status: 'completed',
        });
        let b2 = put(b, 'dispatch', id, {
          id,
          rule_ref: ruleRef,
          provider_name: providerName,
          status: 'completed',
          result,
          created_at: now,
        });
        return complete(b2, 'ok', { dispatch: id, result }) as StorageProgram<Result>;
      },
      (b) => {
        // Provider not found
        return complete(b, 'notfound', { provider_name: providerName }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  list_providers(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'automation-provider-registry', {}, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all as Array<Record<string, unknown>>) || [];
      const providers = all.map(r => r.name as string).filter(Boolean);
      return { providers };
    }) as StorageProgram<Result>;
  },
};

export const automationDispatchHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetAutomationDispatch(): void {
  idCounter = 0;
}
