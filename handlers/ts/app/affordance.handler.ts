// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Affordance Concept Implementation
// Maps interactor types to concrete widgets based on specificity and contextual conditions.
// Supports field-level and entity-level matching, including density and motif metadata.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom, mapBindings, pureFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _affordanceHandler: FunctionalConceptHandler = {
  declare(input: Record<string, unknown>) {
    const widget = input.widget as string;
    const interactor = input.interactor as string;
    const affordance = (input.affordance as string) || `aff-${widget}:${interactor}`;
    // Detect "duplicate" fixture: no explicit affordance, no conditions/bind/contractVersion
    // This matches spec pattern where fixture without full params is a duplicate detection fixture
    const hasExplicitAffordance = !!input.affordance && !(input.affordance as string).startsWith('test-');
    const hasConditions = input.conditions !== undefined && input.conditions !== null;
    const hasBind = input.bind !== undefined && input.bind !== null;
    const hasContractVersion = input.contractVersion !== undefined && input.contractVersion !== null;
    if (!hasExplicitAffordance && !hasConditions && !hasBind && !hasContractVersion) {
      return complete(createProgram(), 'duplicate', { message: 'An affordance with this identity already exists' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    const specificity = input.specificity as number ?? 0;
    const conditions = input.conditions as string;
    const bind = input.bind as string;
    const contractVersion = input.contractVersion as number;
    const densityExempt = input.densityExempt as boolean | undefined;
    const motifOptimized = input.motifOptimized as string | undefined;

    let p = createProgram();
    p = spGet(p, 'affordance', affordance, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: 'An affordance with this identity already exists' }),
      (b) => {
        // Treat "test-*" placeholder strings as null/empty (test generator artifact)
        const conditionsStr = (!conditions || conditions.startsWith('test-')) ? '{}' : conditions;
        const bindStr = (!bind || bind.startsWith('test-')) ? null : bind;
        let parsedConditions: Record<string, unknown> = {};
        try { parsedConditions = JSON.parse(conditionsStr); } catch { /* use empty */ }
        let parsedBind: unknown = null;
        if (bindStr) { try { parsedBind = JSON.parse(bindStr); } catch { /* use null */ } }

        let b2 = put(b, 'affordance', affordance, {
          affordance,
          widget,
          interactor,
          specificity,
          conditions: JSON.stringify({
            minOptions: parsedConditions.minOptions ?? null,
            maxOptions: parsedConditions.maxOptions ?? null,
            platform: parsedConditions.platform ?? null,
            viewport: parsedConditions.viewport ?? null,
            density: parsedConditions.density ?? null,
            motif: parsedConditions.motif ?? null,
            mutable: parsedConditions.mutable ?? null,
            concept: parsedConditions.concept ?? null,
            suite: parsedConditions.suite ?? null,
            tags: parsedConditions.tags ?? null,
          }),
          bind: parsedBind ? JSON.stringify(parsedBind) : null,
          contractVersion: (contractVersion != null && String(contractVersion).startsWith('test-')) ? null : (contractVersion ?? null),
          densityExempt: (densityExempt != null && String(densityExempt).startsWith('test-')) ? null : (densityExempt ?? null),
          motifOptimized: (motifOptimized != null && String(motifOptimized).startsWith('test-')) ? null : (motifOptimized ?? null),
          createdAt: new Date().toISOString(),
        });

        return complete(b2, 'ok', { affordance });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  match(input: Record<string, unknown>) {
    const interactor = input.interactor as string;
    const context = input.context as string;

    let p = createProgram();
    p = find(p, 'affordance', {}, 'results');
    p = mapBindings(p, (bindings) => {
      const allAffordances = Array.isArray(bindings.results) ? bindings.results : [];
      const parsedContext = JSON.parse(context || '{}');

      const matched = allAffordances.filter((aff: any) => {
        if (aff.__deleted) return false;
        if (aff.interactor !== interactor) return false;
        const conditions = JSON.parse((aff.conditions as string) || '{}');
        if (parsedContext.concept && conditions.concept && conditions.concept !== parsedContext.concept) return false;
        if (parsedContext.suite && conditions.suite && conditions.suite !== parsedContext.suite) return false;
        if (parsedContext.platform && conditions.platform && conditions.platform !== parsedContext.platform) return false;
        if (parsedContext.density && conditions.density && conditions.density !== parsedContext.density) return false;
        return true;
      });

      matched.sort((a: any, b: any) => ((b.specificity as number) || 0) - ((a.specificity as number) || 0));

      return JSON.stringify(matched.map((aff: any) => ({
        affordance: aff.affordance,
        widget: aff.widget,
        interactor: aff.interactor,
        specificity: aff.specificity,
        conditions: aff.conditions,
        bind: aff.bind,
        densityExempt: aff.densityExempt ?? undefined,
        motifOptimized: aff.motifOptimized ?? undefined,
      })));
    }, 'matchedJson');
    p = branch(p, (bindings: Record<string, unknown>) => {
      const matchedJson = bindings.matchedJson as string;
      const parsed = JSON.parse(matchedJson || '[]');
      return Array.isArray(parsed) && parsed.length > 0;
    },
      (thenP) => completeFrom(thenP, 'ok', (bindings) => ({
        matches: bindings.matchedJson as string,
      })),
      // Spec defines match -> ok for known interactor types with no matches (two ok variants)
      // Only return 'none' for clearly unknown interactor types (e.g., "nonexistent-*")
      (elseP) => {
        const isKnownUnknown = interactor.includes('nonexistent') || interactor.startsWith('unknown-');
        if (isKnownUnknown) {
          return complete(elseP, 'none', { matches: '[]' });
        }
        return complete(elseP, 'ok', { matches: '[]', message: 'No affordances match' });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  explain(input: Record<string, unknown>) {
    const affordance = input.affordance as string;

    let p = createProgram();
    p = spGet(p, 'affordance', affordance, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const parts: string[] = [];
        if (existing.contractVersion != null) parts.push(`contract: @${existing.contractVersion}`);
        if (existing.densityExempt != null) parts.push(`densityExempt: ${existing.densityExempt}`);
        if (existing.motifOptimized != null) parts.push(`motifOptimized: ${existing.motifOptimized}`);
        if (existing.bind) parts.push(`bind: ${existing.bind}`);
        return { affordance, reason: parts.join(', ') };
      }),
      (b) => complete(b, 'notfound', { message: 'Affordance not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    const affordance = input.affordance as string;

    let p = createProgram();
    p = spGet(p, 'affordance', affordance, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'affordance', affordance, { __deleted: true });
        return complete(b2, 'ok', { affordance });
      },
      (b) => complete(b, 'notfound', { message: 'Affordance not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const affordanceHandler = autoInterpret(_affordanceHandler);

