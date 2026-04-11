// @clef-handler style=functional
// SchemaTemplate Concept Implementation
// Pre-built schema starting points that create a complete content model in one action.
// See schema-editor-plan.md §1.2, §9.4 for design rationale.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _schemaTemplateHandler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const name = (input.name as string | undefined) ?? '';
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const label = (input.label as string | undefined) ?? name;
    const description = (input.description as string | undefined) ?? '';
    const category = (input.category as string | undefined) ?? '';
    const icon = (input.icon as string | undefined) ?? '';
    const fields = (input.fields as string | undefined) ?? '[]';
    const properties = (input.properties as string | undefined) ?? '{}';
    const sampleData = (input.sampleData as string | undefined) ?? '';

    // Validate that fields and properties are parseable JSON
    try {
      JSON.parse(fields);
    } catch {
      return complete(createProgram(), 'error', { message: 'fields must be valid JSON' }) as StorageProgram<Result>;
    }
    try {
      JSON.parse(properties);
    } catch {
      return complete(createProgram(), 'error', { message: 'properties must be valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'schemaTemplate', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { name }),
      (b) => {
        let b2 = put(b, 'schemaTemplate', name, {
          name,
          label,
          description,
          category,
          icon,
          fields,
          properties,
          sampleData,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { id: name });
      },
    );
    return p as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const name = (input.name as string | undefined) ?? '';
    const targetSchemaName = (input.targetSchemaName as string | undefined) ?? name;

    let p = createProgram();
    p = spGet(p, 'schemaTemplate', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { schema: targetSchemaName }),
      (b) => complete(b, 'not_found', { message: `Template '${name}' does not exist` }),
    );
    return p as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const category = (input.category as string | undefined) ?? '';

    let p = createProgram();
    p = find(p, 'schemaTemplate', {}, 'allTemplates');
    p = mapBindings(p, (bindings) => {
      const all = Array.isArray(bindings.allTemplates)
        ? (bindings.allTemplates as Array<Record<string, unknown>>)
        : [];
      const filtered = category
        ? all.filter((t) => t.category === category)
        : all;
      return JSON.stringify(filtered);
    }, 'itemsJson');
    return complete(p, 'ok', { items: '' }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const name = (input.name as string | undefined) ?? '';

    let p = createProgram();
    p = spGet(p, 'schemaTemplate', name, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const t = bindings.existing as Record<string, unknown>;
        return {
          label: t.label as string,
          description: t.description as string,
          category: t.category as string,
          icon: t.icon as string,
          fields: t.fields as string,
          sampleData: (t.sampleData as string | undefined) ?? '',
        };
      }),
      (b) => complete(b, 'not_found', { message: `Template '${name}' does not exist` }),
    );
    return p as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const name = (input.name as string | undefined) ?? '';

    let p = createProgram();
    p = spGet(p, 'schemaTemplate', name, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'schemaTemplate', name);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'not_found', { message: `Template '${name}' does not exist` }),
    );
    return p as StorageProgram<Result>;
  },

};

export const schemaTemplateHandler = autoInterpret(_schemaTemplateHandler);
