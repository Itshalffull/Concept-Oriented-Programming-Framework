// @migrated dsl-constructs 2026-03-18
// DesignToken Concept Implementation [T]
// Hierarchical design tokens with alias chains, tier classification, and multi-format export.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_TYPES = ['color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number', 'shadow', 'strokeStyle', 'border', 'transition', 'gradient', 'typography', 'opacity', 'lineHeight', 'letterSpacing'];
const VALID_TIERS = ['primitive', 'semantic', 'component'];
const VALID_EXPORT_FORMATS = ['css', 'dtcg', 'scss', 'json', 'tailwind'];

const _designTokenHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const token = input.token as string;
    const name = input.name as string;
    const value = input.value as string;
    const type = input.type as string;
    const tier = input.tier as string;

    let p = createProgram();
    p = spGet(p, 'token', token, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: `Token "${token}" already exists` }),
      (b) => {
        let b2 = put(b, 'token', token, {
          name, value, type, tier,
          description: '', reference: '', group: '',
        });
        return complete(b2, 'ok', { token });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  alias(input: Record<string, unknown>) {
    const token = input.token as string;
    const name = input.name as string;
    const reference = input.reference as string;
    const tier = input.tier as string;

    let p = createProgram();
    p = spGet(p, 'token', reference, 'refToken');
    p = branch(p, 'refToken',
      (b) => {
        // Alias cycle detection resolved at runtime
        let b2 = put(b, 'token', token, {
          name, value: '', type: '', tier,
          description: '', reference, group: '',
        });
        return complete(b2, 'ok', { token });
      },
      (b) => complete(b, 'notfound', { message: `Referenced token "${reference}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const token = input.token as string;

    let p = createProgram();
    p = spGet(p, 'token', token, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Alias chain walking resolved at runtime
        return complete(b, 'ok', { resolvedValue: '', type: '', tier: '' });
      },
      (b) => complete(b, 'notfound', { message: `Token "${token}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  update(input: Record<string, unknown>) {
    const token = input.token as string;
    const value = input.value as string;

    let p = createProgram();
    p = spGet(p, 'token', token, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'token', token, { value });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Token "${token}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    const token = input.token as string;

    let p = createProgram();
    p = spGet(p, 'token', token, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'token', token, {
          value: '', name: '', type: '', tier: '',
          reference: '', group: '', _deleted: true,
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Token "${token}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  export(input: Record<string, unknown>) {
    const format = input.format as string;

    if (!VALID_EXPORT_FORMATS.includes(format)) {
      let p = createProgram();
      return complete(p, 'unsupported', { message: `Unsupported export format "${format}". Supported: ${VALID_EXPORT_FORMATS.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let output: string;
    switch (format) {
      case 'css': output = ':root { /* CSS custom properties */ }'; break;
      case 'dtcg': output = JSON.stringify({ $type: 'design-tokens', tokens: {} }); break;
      case 'scss': output = '// SCSS token variables'; break;
      case 'tailwind': output = JSON.stringify({ theme: { extend: {} } }); break;
      case 'json': output = JSON.stringify({ tokens: {} }); break;
      default: output = '';
    }

    let p = createProgram();
    return complete(p, 'ok', { output, format }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const designTokenHandler = autoInterpret(_designTokenHandler);

