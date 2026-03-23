// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, complete, completeFrom, branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const TRANSFORMS = 'render-transforms';
const KINDS = 'render-transform-kinds';

type Result = { variant: string; [key: string]: unknown };

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
const _renderTransformHandler: FunctionalConceptHandler = {
  registerKind(input: Record<string, unknown>) {
    if (!input.kind || (typeof input.kind === 'string' && (input.kind as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }
    const kind = input.kind as string;
    const kindId = `kind-${kind}`;

    let p = createProgram();
    p = get(p, KINDS, kindId, 'existing');
    return branch(p, 'existing',
      (thenP) => complete(thenP, 'duplicate', { kind }),
      (elseP) => {
        elseP = put(elseP, KINDS, kindId, { kind });
        return complete(elseP, 'ok', { kind });
      },
    ) as StorageProgram<Result>;
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
      return p as StorageProgram<Result>;
    }

    const transformId = `rt-${name}`;
    let p = createProgram();
    p = get(p, TRANSFORMS, transformId, 'existing');
    return branch(p, 'existing',
      (thenP) => complete(thenP, 'duplicate', { transform: transformId }),
      (elseP) => {
        elseP = put(elseP, TRANSFORMS, transformId, { name, kind, spec });
        return complete(elseP, 'ok', { transform: transformId });
      },
    ) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const programStr = input.program as string;
    const kind = input.kind as string;
    const specStr = input.spec as string;

    // Only validate spec JSON if provided
    if (specStr) {
      try {
        JSON.parse(specStr);
      } catch (e) {
        const p = complete(createProgram(), 'error', {
          message: `Invalid spec: ${(e as Error).message}`,
        });
        return p as StorageProgram<Result>;
      }
    }

    // The handler produces the dispatch program — the actual transform
    // is applied by the provider through sync wiring.
    let p = createProgram();
    p = complete(p, 'ok', {
      result: programStr,
      appliedTransforms: '[]',
      kind,
      spec: specStr,
    });
    return p as StorageProgram<Result>;
  },

  compose(input: Record<string, unknown>) {
    const transformsStr = input.transforms as string;

    try {
      const transformSpecs: Array<{ name: string; kind: string; spec: string }> = JSON.parse(transformsStr);

      if (transformSpecs.length === 0) {
        const p = complete(createProgram(), 'error', {
          message: 'Cannot compose empty transform list',
        });
        return p as StorageProgram<Result>;
      }

      // Compose by creating a composite spec that chains transforms
      const composedName = transformSpecs.map(t => t.name).join('+');
      const composedId = `rt-${composedName}`;

      let p = createProgram();
      p = put(p, TRANSFORMS, composedId, {
        name: composedName,
        kind: 'composed',
        spec: JSON.stringify({ chain: transformSpecs }),
      });
      p = complete(p, 'ok', {
        composed: composedId,
        name: composedName,
      });
      return p as StorageProgram<Result>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Failed to compose transforms: ${(e as Error).message}`,
      });
      return p as StorageProgram<Result>;
    }
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, TRANSFORMS, {}, 'allTransforms');
    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.allTransforms as Record<string, unknown>[];
      return { transforms: JSON.stringify(items.map(t => ({ name: t.name, kind: t.kind }))) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;
    const transformId = `rt-${name}`;

    let p = createProgram();
    p = get(p, TRANSFORMS, transformId, 'transform');
    return branch(p, 'transform',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const t = bindings.transform as Record<string, unknown>;
        return {
          transform: transformId,
          kind: t.kind as string,
          spec: t.spec as string,
        };
      }),
      (elseP) => complete(elseP, 'notfound', { message: `Transform '${name}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const renderTransformHandler = autoInterpret(_renderTransformHandler);
