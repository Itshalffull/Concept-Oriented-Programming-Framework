// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, find, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _appInstallationHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.installation || (typeof input.installation === 'string' && (input.installation as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'installation is required' }) as StorageProgram<Result>;
    }
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.version || (typeof input.version === 'string' && (input.version as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'version is required' }) as StorageProgram<Result>;
    }
    if (!input.status || (typeof input.status === 'string' && (input.status as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'status is required' }) as StorageProgram<Result>;
    }
    if (!input.registry || (typeof input.registry === 'string' && (input.registry as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'registry is required' }) as StorageProgram<Result>;
    }
    const installation = String(input.installation ?? '');
    let p = createProgram();
    p = put(p, 'installation', installation, {
      id: installation,
      installation,
      name: String(input.name ?? ''),
      version: String(input.version ?? ''),
      status: String(input.status ?? ''),
      registry: String(input.registry ?? ''),
      description: typeof input.description === 'string' ? input.description : '',
      concepts: Number(input.concepts ?? 0),
      syncs: Number(input.syncs ?? 0),
    });
    return complete(p, 'ok', { installation }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(input: Record<string, unknown>) {
    const status = typeof input.status === 'string' && input.status.trim() ? String(input.status) : undefined;
    let p = createProgram();
    if (status) {
      p = find(p, 'installation', { status }, 'installations');
    } else {
      p = find(p, 'installation', {}, 'installations');
    }
    return completeFrom(p, 'ok', (bindings) => ({ installations: bindings.installations ?? [] }));
  },
};

export const appInstallationHandler = autoInterpret(_appInstallationHandler);


export default appInstallationHandler;
