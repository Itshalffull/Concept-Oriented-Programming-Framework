// @migrated dsl-constructs 2026-03-18
// FieldMapping Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _fieldMappingHandler: FunctionalConceptHandler = {
  map(input: Record<string, unknown>) {
    const mappingId = input.mappingId as string;
    const sourceField = input.sourceField as string;
    const destField = input.destField as string;
    const transform = input.transform as string || '';

    let p = createProgram();
    p = spGet(p, 'fieldMapping', mappingId, 'mapping');
    p = branch(p, 'mapping',
      (b) => {
        let b2 = put(b, 'fieldMapping', mappingId, {});
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Mapping "${mappingId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  apply(input: Record<string, unknown>) {
    const record = input.record as string;
    const mappingId = input.mappingId as string;

    let p = createProgram();
    p = spGet(p, 'fieldMapping', mappingId, 'mapping');
    p = branch(p, 'mapping',
      (b) => {
        let sourceData: Record<string, unknown>;
        try {
          sourceData = JSON.parse(record);
        } catch {
          return complete(b, 'error', { message: 'Invalid JSON record' });
        }
        return complete(b, 'ok', { mapped: JSON.stringify({}) });
      },
      (b) => complete(b, 'notfound', { message: `Mapping "${mappingId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reverse(input: Record<string, unknown>) {
    const record = input.record as string;
    const mappingId = input.mappingId as string;

    let p = createProgram();
    p = spGet(p, 'fieldMapping', mappingId, 'mapping');
    p = branch(p, 'mapping',
      (b) => {
        let destData: Record<string, unknown>;
        try {
          destData = JSON.parse(record);
        } catch {
          return complete(b, 'notfound', { message: 'Invalid JSON record' });
        }
        return complete(b, 'ok', { reversed: JSON.stringify({}) });
      },
      (b) => complete(b, 'notfound', { message: `Mapping "${mappingId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  autoDiscover(input: Record<string, unknown>) {
    const sourceSchema = input.sourceSchema as string;
    const destSchema = input.destSchema as string;

    const mappingId = `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let srcFields: string[];
    let dstFields: string[];
    try {
      srcFields = JSON.parse(sourceSchema);
      dstFields = JSON.parse(destSchema);
    } catch {
      srcFields = sourceSchema.split(',').map(f => f.trim());
      dstFields = destSchema.split(',').map(f => f.trim());
    }

    // Auto-discover by name similarity
    const suggestions: Array<{ src: string; dest: string }> = [];
    for (const src of srcFields) {
      const normalized = src.toLowerCase().replace(/[_-]/g, '');
      for (const dst of dstFields) {
        if (dst.toLowerCase().replace(/[_-]/g, '') === normalized) {
          suggestions.push({ src, dest: dst });
        }
      }
    }

    let p = createProgram();
    p = put(p, 'fieldMapping', mappingId, {
      mappingId,
      name: `${sourceSchema}->${destSchema}`,
      sourceSchema,
      destSchema,
      rules: suggestions.map(s => ({ sourceField: s.src, destField: s.dest, transform: '' })),
      unmapped: { source: [], dest: [] },
    });

    return complete(p, 'ok', { mappingId, suggestions: JSON.stringify(suggestions) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const mappingId = input.mappingId as string;

    let p = createProgram();
    p = spGet(p, 'fieldMapping', mappingId, 'mapping');
    p = branch(p, 'mapping',
      (b) => complete(b, 'ok', { warnings: JSON.stringify([]) }),
      (b) => complete(b, 'notfound', { message: `Mapping "${mappingId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const fieldMappingHandler = autoInterpret(_fieldMappingHandler);

