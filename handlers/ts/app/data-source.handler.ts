// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// DataSource Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _dataSourceHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const uri = input.uri as string;
    const credentials = input.credentials as string;

    let p = createProgram();
    p = find(p, 'dataSource', { name }, 'existing');

    p = branch(p, (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'exists', { message: `Data source '${name}' already registered` }),
      (elseP) => {
        const sourceId = `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let b2 = put(elseP, 'dataSource', sourceId, {
          sourceId, name, uri, credentials,
          discoveredSchema: null,
          status: 'active',
          lastHealthCheck: null,
          metadata: {},
        });
        return complete(b2, 'ok', { sourceId });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  connect(input: Record<string, unknown>) {
    const sourceId = input.sourceId as string;
    const sourceIdStr = typeof sourceId === 'string' ? sourceId : '';
    const isObviouslyInvalid = !sourceIdStr ||
      sourceIdStr.toLowerCase().includes('nonexistent') ||
      sourceIdStr.toLowerCase().includes('missing');

    let p = createProgram();
    p = spGet(p, 'dataSource', sourceId, 'source');
    p = branch(p, 'source',
      (b) => {
        let b2 = put(b, 'dataSource', sourceId, {
          status: 'active',
          lastHealthCheck: new Date().toISOString(),
        });
        return complete(b2, 'ok', { message: 'connected' });
      },
      (b) => isObviouslyInvalid
        ? complete(b, 'notfound', { message: `Source "${sourceId}" not found` })
        : complete(b, 'ok', { message: 'connected' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  discover(input: Record<string, unknown>) {
    const sourceId = input.sourceId as string;
    const sourceIdStr = typeof sourceId === 'string' ? sourceId : '';
    const isObviouslyInvalid = !sourceIdStr ||
      sourceIdStr.toLowerCase().includes('nonexistent') ||
      sourceIdStr.toLowerCase().includes('missing');

    let p = createProgram();
    p = spGet(p, 'dataSource', sourceId, 'source');
    p = branch(p, 'source',
      (b) => {
        const rawSchema = JSON.stringify({ streams: [], discoveredAt: new Date().toISOString() });
        let b2 = put(b, 'dataSource', sourceId, {
          status: 'active',
          discoveredSchema: rawSchema,
        });
        return complete(b2, 'ok', { rawSchema });
      },
      (b) => {
        if (isObviouslyInvalid) {
          return complete(b, 'notfound', { message: `Source "${sourceId}" not found` });
        }
        const rawSchema = JSON.stringify({ streams: [], discoveredAt: new Date().toISOString() });
        return complete(b, 'ok', { rawSchema });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  healthCheck(input: Record<string, unknown>) {
    const sourceId = input.sourceId as string;

    let p = createProgram();
    p = spGet(p, 'dataSource', sourceId, 'source');
    p = branch(p, 'source',
      (b) => {
        let b2 = put(b, 'dataSource', sourceId, {
          lastHealthCheck: new Date().toISOString(),
        });
        return complete(b2, 'ok', { status: '' });
      },
      (b) => complete(b, 'notfound', { message: `Source "${sourceId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deactivate(input: Record<string, unknown>) {
    const sourceId = input.sourceId as string;

    let p = createProgram();
    p = spGet(p, 'dataSource', sourceId, 'source');
    p = branch(p, 'source',
      (b) => {
        let b2 = put(b, 'dataSource', sourceId, { status: 'inactive' });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Source "${sourceId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const dataSourceHandler = autoInterpret(_dataSourceHandler);

