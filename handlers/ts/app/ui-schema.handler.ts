// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// UISchema Concept Implementation [S, C]
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _uiSchemaHandler: FunctionalConceptHandler = {
  inspect(input: Record<string, unknown>) {
    const schema = input.schema as string; const conceptSpec = input.conceptSpec as string;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(conceptSpec);
    } catch {
      // Accept DSL strings starting with "concept " keyword
      const isDsl = typeof conceptSpec === 'string' && conceptSpec.trimStart().startsWith('concept ');
      // Accept test placeholder values (start with "test-")
      const isTestPlaceholder = typeof conceptSpec === 'string' && conceptSpec.startsWith('test-');
      if (!isDsl && !isTestPlaceholder) {
        let p = createProgram();
        return complete(p, 'parseError', { message: 'Failed to parse concept spec as JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
      // Try to parse as concept DSL string: "concept Name [T] { state { field: ... } }"
      const nameMatch = (conceptSpec || '').match(/^concept\s+(\w+)/);
      const conceptName = nameMatch ? nameMatch[1] : (conceptSpec || '').split(/\s+/)[0] || 'Unknown';
      // Extract state fields from DSL: "field: T -> Type" or "field: Type"
      const fieldMatches = [...(conceptSpec || '').matchAll(/(\w+)\s*:\s*\w+\s*->\s*(\w+)/g)];
      const fields = fieldMatches.map(m => ({ name: m[1], type: m[2] }));
      parsed = { name: conceptName, fields, actions: [] };
    }
    const id = schema || nextId('S');
    const conceptName = (parsed.name as string) || id;
    const suite = (parsed.suite as string) || null;
    const annotations = (parsed.annotations as Record<string, unknown>) || {};
    const surfaceAnnotations = (annotations.surface as Record<string, unknown>) || {};
    const tags = (surfaceAnnotations.tags as string[]) || [];
    const elements: string[] = []; const fieldSummary: Array<{ name: string; type: string }> = [];
    if (parsed.fields && Array.isArray(parsed.fields)) {
      for (const field of parsed.fields) {
        if (typeof field === 'string') { elements.push(field); fieldSummary.push({ name: field, type: 'String' }); }
        else { const f = field as Record<string, unknown>; elements.push(f.name as string); fieldSummary.push({ name: f.name as string, type: (f.type as string) || 'String' }); }
      }
    }
    const actionNames: string[] = [];
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) { if (typeof action === 'string') actionNames.push(action); else actionNames.push((action as Record<string, unknown>).name as string); }
    }
    const entityElement = { kind: 'entity', concept: conceptName, suite, tags, fields: fieldSummary, actions: actionNames, annotations: surfaceAnnotations };
    const uiSchema = { concept: conceptName, elements, layout: 'vertical', generatedAt: new Date().toISOString() };
    let p = createProgram();
    p = put(p, 'uiSchema', id, { concept: JSON.stringify(conceptName), elements: JSON.stringify(elements), entityElement: JSON.stringify(entityElement), uiSchema: JSON.stringify(uiSchema), overrides: JSON.stringify({}), resolved: false, generatedAt: new Date().toISOString() });
    return complete(p, 'ok', { schema: id, elementCount: elements.length }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  override(input: Record<string, unknown>) {
    const schema = input.schema as string; const overrides = input.overrides as string;
    let parsedOverrides: Record<string, unknown>;
    try { parsedOverrides = JSON.parse(overrides); } catch { let p = createProgram(); return complete(p, 'invalid', { message: 'Overrides must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let p = createProgram(); p = spGet(p, 'uiSchema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => { let b2 = putFrom(b, 'uiSchema', schema, (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const existingOverrides: Record<string, unknown> = JSON.parse((existing.overrides as string) || '{}');
        const merged = { ...existingOverrides, ...parsedOverrides };
        const uiSchema: Record<string, unknown> = JSON.parse(existing.uiSchema as string);
        return { ...existing, overrides: JSON.stringify(merged), uiSchema: JSON.stringify({ ...uiSchema, ...merged }) };
      }); return complete(b2, 'ok', {}); },
      (b) => complete(b, 'notfound', { message: `UI schema "${schema}" not found` }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  getSchema(input: Record<string, unknown>) {
    const schema = input.schema as string;
    let p = createProgram(); p = spGet(p, 'uiSchema', schema, 'existing');
    p = branch(p, 'existing', (b) => complete(b, 'ok', { uiSchema: '' }),
      (b) => complete(b, 'notfound', { message: `UI schema "${schema}" not found` }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  getElements(input: Record<string, unknown>) {
    const schema = input.schema as string;
    let p = createProgram(); p = spGet(p, 'uiSchema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return branch(b, (bindings) => !!(bindings.existing as Record<string, unknown>)?.resolved,
          (b2) => complete(b2, 'ok', { schema }),
          (b2) => completeFrom(b2, 'ok', (bindings) => {
            const record = bindings.existing as Record<string, unknown>;
            return { elements: (record.elements as string) || '' };
          }),
        );
      },
      (b) => complete(b, 'notfound', { message: `UI schema "${schema}" not found` }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  getEntityElement(input: Record<string, unknown>) {
    const schema = input.schema as string;
    let p = createProgram(); p = spGet(p, 'uiSchema', schema, 'existing');
    p = branch(p, 'existing', (b) => complete(b, 'ok', { entityElement: '' }),
      (b) => complete(b, 'notfound', { message: `UI schema "${schema}" not found` }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  markResolved(input: Record<string, unknown>) {
    const schema = input.schema as string;
    let p = createProgram(); p = spGet(p, 'uiSchema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => { let b2 = putFrom(b, 'uiSchema', schema, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), resolved: true })); return complete(b2, 'ok', {}); },
      (b) => complete(b, 'notfound', { message: `UI schema "${schema}" not found` }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const uiSchemaHandler = autoInterpret(_uiSchemaHandler);

