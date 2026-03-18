import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';
import {
  createProgram, putLens, getLens, find, complete, relation, at,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

// Lenses for storing transforms and registered kinds
const transformsRel = relation('transforms');
const kindsRel = relation('registeredKinds');

/**
 * RenderTransform — registry and dispatcher handler.
 *
 * Manages named transforms and dispatches apply() calls to the
 * appropriate provider based on kind. Transform logic lives in
 * individual provider handlers (TokenRemapProvider, A11yAdaptProvider,
 * BindRewriteProvider, CustomTransformProvider), not here.
 *
 * Satisfies functor laws:
 * - Identity: apply(p, kind, emptySpec) = p (delegated to provider)
 * - Composition: apply(p, compose([f, g])) = apply(apply(p, f), g)
 */
const renderTransformHandlerFunctional: FunctionalConceptHandler = {
  registerKind(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const kindId = `kind-${kind}`;

    let p = createProgram();
    p = getLens(p, at(kindsRel, kindId), 'existing');
    p = putLens(p, at(kindsRel, kindId), { kind });
    p = complete(p, 'ok', { kind });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const kind = input.kind as string;
    const spec = input.spec as string;

    // Validate the spec is parseable JSON
    try {
      JSON.parse(spec);
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Invalid transform spec: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const transformId = `rt-${name}`;
    let p = createProgram();
    p = getLens(p, at(transformsRel, transformId), 'existing');
    p = putLens(p, at(transformsRel, transformId), {
      name,
      kind,
      spec,
    });
    p = complete(p, 'ok', { transform: transformId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  apply(input: Record<string, unknown>) {
    const programStr = input.program as string;
    const kind = input.kind as string;
    const specStr = input.spec as string;

    // Validate program is parseable
    try {
      JSON.parse(programStr);
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Invalid program: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // The handler produces the dispatch program — the actual transform
    // is applied by the provider through sync wiring. The sync matches
    // on the kind and routes to the appropriate provider's apply action.
    // For direct invocation (without sync wiring), callers should use
    // the provider handlers directly.
    let p = createProgram();
    p = complete(p, 'ok', {
      result: programStr,
      appliedTransforms: '[]',
      kind,
      spec: specStr,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  compose(input: Record<string, unknown>) {
    const transformsStr = input.transforms as string;

    try {
      const transformSpecs: Array<{ name: string; kind: string; spec: string }> = JSON.parse(transformsStr);

      if (transformSpecs.length === 0) {
        const p = complete(createProgram(), 'error', {
          message: 'Cannot compose empty transform list',
        });
        return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }

      // Compose by creating a composite spec that chains transforms
      const composedName = transformSpecs.map(t => t.name).join('+');
      const composedId = `rt-${composedName}`;

      let p = createProgram();
      p = putLens(p, at(transformsRel, composedId), {
        name: composedName,
        kind: 'composed',
        spec: JSON.stringify({ chain: transformSpecs }),
      });
      p = complete(p, 'ok', {
        composed: composedId,
        name: composedName,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Failed to compose transforms: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  list(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'transforms', {}, 'allTransforms');
    p = complete(p, 'ok', { transforms: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;
    const transformId = `rt-${name}`;

    let p = createProgram();
    p = getLens(p, at(transformsRel, transformId), 'transform');
    p = complete(p, 'ok', {
      transform: transformId,
      kind: '',
      spec: '',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const renderTransformHandler = wrapFunctional(renderTransformHandlerFunctional);
export { renderTransformHandlerFunctional };
