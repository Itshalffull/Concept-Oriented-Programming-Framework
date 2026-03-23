// @clef-handler style=functional
// NextjsSdkTarget Concept Implementation
// Generates Next.js SDK client libraries from projections.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;

    if (!projection || (typeof projection === 'string' && projection.trim() === '')) {
      return complete(createProgram(), 'error', { reason: 'projection is required' }) as StorageProgram<Result>;
    }

    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try { config = JSON.parse(input.config) as Record<string, unknown>; } catch { /* use defaults */ }
    }

    const packageName = (config.packageName as string) || '@clef/nextjs-sdk';

    const stubFile = `// Auto-generated Next.js SDK client stub for projection: ${projection}\nexport {};\n`;
    const files = [{ path: `${projection}/index.ts`, content: stubFile }];

    let p = createProgram();
    p = put(p, 'packages', projection, { projection, packageName, status: 'generated' });
    return complete(p, 'ok', { files, package: packageName }) as StorageProgram<Result>;
  },
};

export const nextjsSdkTargetHandler = autoInterpret(_handler);
