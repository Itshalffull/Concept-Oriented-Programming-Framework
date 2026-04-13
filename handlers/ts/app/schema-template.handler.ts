// @clef-handler style=functional
// SchemaTemplate Concept Implementation
// Pre-built schema starting points that create a complete content model in one action.
// See schema-editor-plan.md §1.2, §9.4 for design rationale.
//
// NOTE (CUX-09): SchemaTemplate/apply fans out FieldDefinition/create storage writes
// directly into the 'field' relation (key: `${schema}::${fieldId}`) for each entry in
// the template's fields array. This is done via traverse + put rather than through a sync
// because the sync grammar cannot iterate variable-length arrays from completion outputs.
// The SchemaTemplateCreatesFields sync file is therefore retired; field fan-out lives here.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, mapBindings,
  traverse,
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
      (b) => {
        // Fan out FieldDefinition records via traverse so they land in storage
        // before the completion fires. mapBindings parses the fields JSON string
        // and stores the array under '_parsedFields'; traverse puts each field
        // record into the 'field' relation (key: `${schema}::${fieldId}`).
        // This mirrors the storage contract of FieldDefinition/create without
        // requiring a cross-concept perform call.
        let b2 = mapBindings(b, (bindings) => {
          const t = bindings.existing as Record<string, unknown>;
          let fieldsArr: unknown[] = [];
          try {
            const raw = t.fields as string | undefined;
            if (raw) fieldsArr = JSON.parse(raw) as unknown[];
          } catch {
            // Malformed JSON — default to empty; no FieldDefinitions created
          }
          return fieldsArr;
        }, '_parsedFields');

        b2 = traverse(b2, '_parsedFields', '_field', (item) => {
          const field = item as Record<string, unknown>;
          const fieldId = (field.fieldId as string | undefined) ?? '';
          const schema = targetSchemaName;
          const storageKey = `${schema}::${fieldId}`;
          if (!fieldId) {
            // Skip malformed entries with no fieldId
            return complete(createProgram(), 'ok', { skipped: true });
          }
          const record = {
            id: storageKey,
            fieldId,
            schema,
            label: (field.label as string | undefined) ?? fieldId,
            description: (field.description as string | undefined) ?? '',
            fieldType: (field.fieldType as string | undefined) ?? 'text',
            cardinality: (field.cardinality as string | undefined) ?? 'single',
            typeConfig: (field.typeConfig as string | undefined) ?? '{}',
            required: field.required === true || field.required === 'true',
            unique: field.unique === true || field.unique === 'true',
            validations: (field.validations as string | undefined) ?? '[]',
            defaultValue: (field.defaultValue as string | undefined) ?? '',
            widget: (field.widget as string | undefined) ?? '',
            formatter: (field.formatter as string | undefined) ?? '',
            sortOrder: typeof field.sortOrder === 'number'
              ? field.sortOrder
              : parseInt(field.sortOrder as string, 10) || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const sub = put(createProgram(), 'field', storageKey, record);
          return complete(sub, 'ok', { id: storageKey });
        }, '_fieldResults', {
          writes: ['field'],
          completionVariants: ['ok'],
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const tmpl2 = bindings.existing as Record<string, unknown>;
          // Parse the properties JSON blob into an object so syncs can use dot-access bindings
          // (e.g. bind(?properties.displayWidget as ?dw)) without requiring Property/setBulk.
          let propertiesObj: Record<string, unknown> = {};
          try {
            const raw = tmpl2.properties as string | undefined;
            if (raw) propertiesObj = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            // Malformed JSON — propagate empty object; downstream Property/set calls will no-op
          }
          // Also expose the parsed fields array in the completion so Score/tooling can inspect it.
          const fieldsArr = Array.isArray(bindings._parsedFields) ? bindings._parsedFields : [];
          return {
            schema: targetSchemaName,
            // Surface the parsed properties object so the SchemaTemplatePropertiesToProperties
            // sync can fan out fixed Property/set calls via dot-access bindings.
            properties: propertiesObj,
            // Surface parsed fields array (variable-length — not iterable by sync grammar,
            // but available for Score queries and downstream tooling).
            fields: fieldsArr,
          };
        });
      },
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
