// UISchema Concept Implementation
// Inspects a concept spec and generates a UI schema for form/view rendering.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'schema';

/**
 * Minimal concept spec parser. Extracts concept name, state fields, and actions
 * from a COPF concept spec string.
 *
 * Expects patterns like:
 *   concept Name [T] { state { field: T -> Type } actions { action name(...) { -> variant(...) } } }
 */
function parseConceptSpec(spec: string): {
  name: string;
  stateFields: { name: string; type: string }[];
  actions: { name: string; params: { name: string; type: string }[] }[];
} | null {
  // Extract concept name
  const conceptMatch = spec.match(/concept\s+(\w+)/);
  if (!conceptMatch) return null;

  const name = conceptMatch[1];

  // Extract state fields: "fieldName: TypeParam -> TypeName" or "fieldName: TypeName"
  const stateFields: { name: string; type: string }[] = [];
  const stateBlockMatch = spec.match(/state\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
  if (stateBlockMatch) {
    const stateContent = stateBlockMatch[1];
    const fieldPattern = /(\w+)\s*:\s*(?:\w+\s*->\s*)?(\w+)/g;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(stateContent)) !== null) {
      stateFields.push({ name: fieldMatch[1], type: fieldMatch[2] });
    }
  }

  // Extract actions
  const actions: { name: string; params: { name: string; type: string }[] }[] = [];
  const actionPattern = /action\s+(\w+)\s*\(([^)]*)\)/g;
  let actionMatch;
  while ((actionMatch = actionPattern.exec(spec)) !== null) {
    const actionName = actionMatch[1];
    const paramsStr = actionMatch[2];
    const params: { name: string; type: string }[] = [];
    if (paramsStr.trim()) {
      const paramParts = paramsStr.split(',');
      for (const part of paramParts) {
        const paramMatch = part.trim().match(/(\w+)\s*:\s*(\w+)/);
        if (paramMatch) {
          params.push({ name: paramMatch[1], type: paramMatch[2] });
        }
      }
    }
    actions.push({ name: actionName, params });
  }

  return { name, stateFields, actions };
}

/**
 * Generates UI schema elements from parsed concept spec.
 */
function generateUIElements(parsed: {
  name: string;
  stateFields: { name: string; type: string }[];
  actions: { name: string; params: { name: string; type: string }[] }[];
}): Record<string, unknown>[] {
  const elements: Record<string, unknown>[] = [];

  // Generate form elements for state fields
  for (const field of parsed.stateFields) {
    const element: Record<string, unknown> = {
      type: 'control',
      scope: `#/properties/${field.name}`,
      label: field.name.charAt(0).toUpperCase() + field.name.slice(1),
    };

    // Map types to UI element types
    switch (field.type.toLowerCase()) {
      case 'string':
        element.component = 'text-input';
        break;
      case 'int':
      case 'integer':
      case 'number':
        element.component = 'number-input';
        break;
      case 'bool':
      case 'boolean':
        element.component = 'checkbox';
        break;
      case 'date':
      case 'datetime':
        element.component = 'date-picker';
        break;
      default:
        element.component = 'text-input';
        break;
    }

    elements.push(element);
  }

  // Generate action buttons
  for (const action of parsed.actions) {
    elements.push({
      type: 'action',
      action: action.name,
      label: action.name.charAt(0).toUpperCase() + action.name.slice(1),
      params: action.params.map(p => ({ name: p.name, type: p.type })),
    });
  }

  return elements;
}

export const uischemaHandler: ConceptHandler = {
  /**
   * inspect(schema, conceptSpec) -> ok(schema) | parseError(message)
   * Parses a concept spec string, generates a UI schema, and stores it.
   */
  async inspect(input, storage) {
    const schema = input.schema as string;
    const conceptSpec = input.conceptSpec as string;

    const parsed = parseConceptSpec(conceptSpec);
    if (!parsed) {
      return {
        variant: 'parseError',
        message: 'Failed to parse concept spec. Expected format: concept Name [T] { state { ... } actions { ... } }',
      };
    }

    const elements = generateUIElements(parsed);
    const uiSchema = {
      type: 'VerticalLayout',
      concept: parsed.name,
      elements,
    };

    await storage.put(RELATION, schema, {
      schema,
      concept: parsed.name,
      elements: JSON.stringify(elements),
      uiSchema: JSON.stringify(uiSchema),
      overrides: '{}',
      generatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', schema };
  },

  /**
   * override(schema, overrides) -> ok(schema) | notfound(message) | invalid(message)
   * Merges UI overrides into the stored schema.
   */
  async override(input, storage) {
    const schema = input.schema as string;
    const overridesStr = input.overrides as string;

    const existing = await storage.get(RELATION, schema);
    if (!existing) {
      return { variant: 'notfound', message: `Schema "${schema}" does not exist` };
    }

    // Validate overrides is valid JSON
    let overridesObj: Record<string, unknown>;
    try {
      overridesObj = JSON.parse(overridesStr);
    } catch {
      return { variant: 'invalid', message: 'Overrides must be valid JSON' };
    }

    // Merge overrides with existing
    let existingOverrides: Record<string, unknown>;
    try {
      existingOverrides = JSON.parse((existing.overrides as string) || '{}');
    } catch {
      existingOverrides = {};
    }

    const merged = { ...existingOverrides, ...overridesObj };

    // Apply overrides to uiSchema
    let uiSchema: Record<string, unknown>;
    try {
      uiSchema = JSON.parse(existing.uiSchema as string);
    } catch {
      uiSchema = {};
    }

    // Merge top-level override properties into the schema
    const updatedSchema = { ...uiSchema, ...merged };

    await storage.put(RELATION, schema, {
      ...existing,
      overrides: JSON.stringify(merged),
      uiSchema: JSON.stringify(updatedSchema),
    });

    return { variant: 'ok', schema };
  },

  /**
   * getSchema(schema) -> ok(schema, uiSchema) | notfound(message)
   * Returns the generated UI schema JSON.
   */
  async getSchema(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get(RELATION, schema);
    if (!existing) {
      return { variant: 'notfound', message: `Schema "${schema}" does not exist` };
    }

    return {
      variant: 'ok',
      schema,
      uiSchema: existing.uiSchema as string,
    };
  },

  /**
   * getElements(schema) -> ok(elements) | notfound(message)
   * Returns the individual UI elements list.
   */
  async getElements(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get(RELATION, schema);
    if (!existing) {
      return { variant: 'notfound', message: `Schema "${schema}" does not exist` };
    }

    return {
      variant: 'ok',
      elements: existing.elements as string,
    };
  },
};
