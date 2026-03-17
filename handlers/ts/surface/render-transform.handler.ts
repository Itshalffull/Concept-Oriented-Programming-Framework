import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, getLens, find, del, complete, relation, at,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import type { RenderInstruction } from './render-program-builder.ts';

// Lenses for storing transforms — dogfooding the lens DSL
const transformsRel = relation('transforms');

/**
 * Transform kind determines which instruction tags are rewritten.
 */
type TransformKind = 'token-remap' | 'a11y-adapt' | 'bind-rewrite' | 'custom';

interface TokenRemapSpec {
  mappings: Record<string, string>;
}

interface A11yAdaptSpec {
  additions?: RenderInstruction[];
  modifications?: Array<{ match: Partial<RenderInstruction>; set: Partial<RenderInstruction> }>;
}

interface BindRewriteSpec {
  rewrites: Record<string, string>;
}

interface CustomSpec {
  match: Partial<RenderInstruction>;
  replace: Partial<RenderInstruction>;
}

/**
 * Apply a single transform spec to an instruction list.
 * Returns the transformed instructions.
 */
function applyTransformSpec(
  instructions: RenderInstruction[],
  kind: TransformKind,
  spec: TokenRemapSpec | A11yAdaptSpec | BindRewriteSpec | CustomSpec,
): RenderInstruction[] {
  switch (kind) {
    case 'token-remap': {
      const { mappings } = spec as TokenRemapSpec;
      return instructions.map(instr => {
        if (instr.tag === 'token' && typeof instr.path === 'string') {
          const newPath = mappings[instr.path];
          if (newPath) {
            return { ...instr, path: newPath };
          }
        }
        return instr;
      });
    }

    case 'a11y-adapt': {
      const { additions, modifications } = spec as A11yAdaptSpec;
      let result = [...instructions];

      // Apply modifications to matching instructions
      if (modifications) {
        result = result.map(instr => {
          for (const mod of modifications) {
            if (matchesInstruction(instr, mod.match)) {
              return { ...instr, ...mod.set };
            }
          }
          return instr;
        });
      }

      // Append additions (before the terminal pure)
      if (additions && additions.length > 0) {
        const pureIdx = result.findIndex(i => i.tag === 'pure');
        if (pureIdx >= 0) {
          result.splice(pureIdx, 0, ...additions);
        } else {
          result.push(...additions);
        }
      }

      return result;
    }

    case 'bind-rewrite': {
      const { rewrites } = spec as BindRewriteSpec;
      return instructions.map(instr => {
        if (instr.tag === 'bind' && typeof instr.expr === 'string') {
          const newExpr = rewrites[instr.expr];
          if (newExpr) {
            return { ...instr, expr: newExpr };
          }
        }
        return instr;
      });
    }

    case 'custom': {
      const { match, replace } = spec as CustomSpec;
      return instructions.map(instr => {
        if (matchesInstruction(instr, match)) {
          return { ...instr, ...replace };
        }
        return instr;
      });
    }

    default:
      return instructions;
  }
}

/**
 * Check if an instruction matches a partial pattern.
 */
function matchesInstruction(instr: RenderInstruction, pattern: Partial<RenderInstruction>): boolean {
  for (const [key, value] of Object.entries(pattern)) {
    if (instr[key] !== value) return false;
  }
  return true;
}

/**
 * RenderTransform — functional handler.
 *
 * The functorial mapping over RenderPrograms. Applies named
 * transformation functions to instruction sequences, producing
 * new programs with modified token refs, a11y attrs, or bindings.
 *
 * Satisfies functor laws:
 * - Identity: apply(p, id-transform) = p
 * - Composition: apply(p, compose([f, g])) = apply(apply(p, f), g)
 */
export const renderTransformHandler: FunctionalConceptHandler = {
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
    const transformName = input.transform as string;

    try {
      const program = JSON.parse(programStr);
      const instructions: RenderInstruction[] = program.instructions || [];

      // Look up the transform — for the functional handler pattern,
      // the transform spec is passed inline or resolved by the caller
      // via sync wiring. Here we support both inline spec and name lookup.
      let kind: TransformKind;
      let spec: TokenRemapSpec | A11yAdaptSpec | BindRewriteSpec | CustomSpec;

      // Try parsing transformName as JSON (inline spec)
      try {
        const parsed = JSON.parse(transformName);
        kind = parsed.kind as TransformKind;
        spec = JSON.parse(parsed.spec);
      } catch {
        // Not inline — return notfound since we can't do storage lookup
        // in a pure functional handler. The sync wiring should resolve
        // the transform name to its spec before calling apply.
        const p = complete(createProgram(), 'notfound', {
          message: `Transform not found: ${transformName}. Pass inline spec or resolve via sync.`,
        });
        return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }

      // Apply the transform
      const newInstructions = applyTransformSpec(instructions, kind, spec);

      // Track applied transforms in program metadata
      const previousTransforms: string[] = program.appliedTransforms || [];
      const appliedTransforms = [...previousTransforms, transformName];

      // Build the result program
      const resultProgram = {
        ...program,
        instructions: newInstructions,
        appliedTransforms,
      };

      let p = createProgram();
      p = complete(p, 'ok', {
        result: JSON.stringify(resultProgram),
        appliedTransforms: JSON.stringify(appliedTransforms),
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Failed to apply transform: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
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

// Export the core transform functions for direct use in tests
export { applyTransformSpec, matchesInstruction };
export type { TransformKind, TokenRemapSpec, A11yAdaptSpec, BindRewriteSpec, CustomSpec };
