// ============================================================
// AsyncAPI Target Provider — Interface Kit
//
// Generates a single AsyncAPI 3.0 YAML document covering all
// concepts in the project. Event channels are derived from
// concept actions that produce state changes (create, update,
// delete completions). Each channel represents a domain event
// that fires when the corresponding action completes.
// Architecture doc: Interface Kit
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
  VariantSchema,
} from '../../../../kernel/src/types.js';

import {
  typeToJsonSchema,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  classifyAction,
  getHierarchicalTrait,
} from './codegen-utils.js';

import type { HierarchicalConfig } from './codegen-utils.js';

// --- YAML String Helpers ---

/**
 * Indent every line in a multi-line string by the given number of spaces.
 */
function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

/**
 * Serialize a JSON-schema-like object to inline YAML. Handles primitives,
 * arrays, and nested objects with correct indentation. This avoids needing
 * a YAML library dependency.
 */
function jsonToYaml(obj: unknown, indentLevel: number = 0): string {
  const pad = ' '.repeat(indentLevel);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    if (
      obj === '' ||
      obj.includes(':') ||
      obj.includes('#') ||
      obj.includes('{') ||
      obj.includes('}') ||
      obj.includes('[') ||
      obj.includes(']') ||
      obj.includes(',') ||
      obj.includes('&') ||
      obj.includes('*') ||
      obj.includes('?') ||
      obj.includes('|') ||
      obj.includes('>') ||
      obj.includes("'") ||
      obj.includes('"') ||
      obj.includes('%') ||
      obj.includes('@') ||
      obj.includes('`') ||
      obj.startsWith(' ') ||
      obj.endsWith(' ') ||
      obj === 'true' ||
      obj === 'false' ||
      obj === 'null'
    ) {
      return `'${obj.replace(/'/g, "''")}'`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';

    const allScalar = obj.every(
      (item) => typeof item !== 'object' || item === null,
    );
    if (allScalar) {
      const items = obj.map((item) => jsonToYaml(item, 0)).join(', ');
      return `[${items}]`;
    }

    const lines: string[] = [];
    for (const item of obj) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length > 0) {
          const [firstKey, firstVal] = entries[0];
          lines.push(
            `${pad}- ${firstKey}: ${jsonToYaml(firstVal, indentLevel + 4)}`,
          );
          for (let i = 1; i < entries.length; i++) {
            const [k, v] = entries[i];
            lines.push(
              `${pad}  ${k}: ${jsonToYaml(v, indentLevel + 4)}`,
            );
          }
        } else {
          lines.push(`${pad}- {}`);
        }
      } else {
        lines.push(`${pad}- ${jsonToYaml(item, indentLevel + 2)}`);
      }
    }
    return '\n' + lines.join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    const lines: string[] = [];
    for (const [key, value] of entries) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0
      ) {
        lines.push(`${pad}${key}:`);
        lines.push(jsonToYaml(value, indentLevel + 2));
      } else if (Array.isArray(value) && value.length > 0 && value.some((v) => typeof v === 'object' && v !== null)) {
        lines.push(`${pad}${key}:`);
        lines.push(jsonToYaml(value, indentLevel + 2));
      } else {
        lines.push(`${pad}${key}: ${jsonToYaml(value, indentLevel + 2)}`);
      }
    }
    return lines.join('\n');
  }

  return String(obj);
}

// --- Schema Building ---

/**
 * Build a JSON Schema object for an event message payload.
 * Includes the variant tag and all output fields.
 */
function buildEventPayloadSchema(
  variant: VariantSchema,
  conceptName: string,
  actionName: string,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    variant: { type: 'string', enum: [variant.tag] },
  };
  const required: string[] = ['variant'];

  for (const field of variant.fields) {
    properties[field.name] = typeToJsonSchema(field.type);
    required.push(field.name);
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Build a state schema for a concept (used in component schemas).
 */
function buildStateSchema(manifest: ConceptManifest): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const relation of manifest.relations) {
    for (const field of relation.fields) {
      properties[field.name] = typeToJsonSchema(field.type);
      if (!field.optional) {
        required.push(field.name);
      }
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// --- Event Descriptor ---

interface EventDescriptor {
  conceptName: string;
  actionName: string;
  eventVerb: string;
  channelId: string;
  messageName: string;
  schemaName: string;
  description: string;
  variant: VariantSchema;
}

/**
 * Extract all event descriptors from a concept manifest.
 */
function extractEvents(manifest: ConceptManifest): EventDescriptor[] {
  const events: EventDescriptor[] = [];
  const conceptKebab = toKebabCase(manifest.name);
  const conceptPascal = toPascalCase(manifest.name);

  for (const action of manifest.actions) {
    const classification = classifyAction(action.name);
    if (!classification.eventProducing) {
      continue;
    }

    const eventVerb = classification.eventVerb;
    const okVariant = action.variants.find((v) => v.tag === 'ok');
    if (!okVariant) {
      continue;
    }

    const channelId = `${conceptKebab}/${eventVerb}`;
    const messageName = `${conceptPascal}${toPascalCase(eventVerb)}`;
    const schemaName = `${conceptPascal}${toPascalCase(eventVerb)}Payload`;

    events.push({
      conceptName: manifest.name,
      actionName: action.name,
      eventVerb,
      channelId,
      messageName,
      schemaName,
      description: `Fires when ${conceptPascal}/${action.name} completes with ok`,
      variant: okVariant,
    });
  }

  return events;
}

// --- Document Assembly ---

/**
 * Assemble the full AsyncAPI 3.0 YAML document string.
 */
function assembleAsyncApiDocument(
  manifests: ConceptManifest[],
  manifestYaml: Record<string, unknown>,
  config: Record<string, unknown>,
): string {
  const projectName = (manifestYaml as Record<string, unknown>).name as string || 'Clef Events';
  const projectVersion = (manifestYaml as Record<string, unknown>).version as string || '1.0.0';

  // Collect all events across all concepts
  const allEvents: EventDescriptor[] = [];
  for (const manifest of manifests) {
    allEvents.push(...extractEvents(manifest));
  }

  // Detect @hierarchical traits for each concept
  const hierConfigs = new Map<string, HierarchicalConfig>();
  for (const manifest of manifests) {
    const hierConfig = getHierarchicalTrait(manifestYaml, manifest.name);
    if (hierConfig) {
      hierConfigs.set(manifest.name, hierConfig);
    }
  }

  const lines: string[] = [];

  // --- Header ---
  lines.push('# Auto-generated by Clef Interface Kit — AsyncAPI target');
  lines.push('# Do not edit manually; regenerate with: copf interface generate');
  lines.push('');
  lines.push("asyncapi: '3.0.0'");
  lines.push('info:');
  lines.push(`  title: ${projectName}`);
  lines.push(`  version: '${projectVersion}'`);
  lines.push(`  description: AsyncAPI specification generated from Clef concept definitions`);
  lines.push('');

  // --- Default content type ---
  lines.push('defaultContentType: application/json');
  lines.push('');

  // --- Channels ---
  if (allEvents.length > 0) {
    lines.push('channels:');
    for (const event of allEvents) {
      lines.push(`  ${event.channelId}:`);
      lines.push(`    description: ${event.description}`);
      lines.push(`    messages:`);
      lines.push(`      ${toCamelCase(event.messageName)}:`);
      lines.push(`        $ref: '#/components/messages/${event.messageName}'`);
    }

    // @hierarchical: additional channels for hierarchy events
    for (const [conceptName, hierConfig] of hierConfigs) {
      const conceptKebab = toKebabCase(conceptName);
      const conceptPascal = toPascalCase(conceptName);

      // {concept}.{id}.children.created channel
      const childrenCreatedChannel = `${conceptKebab}/{id}/children/created`;
      const childrenCreatedMsg = `${conceptPascal}ChildrenCreated`;
      lines.push(`  ${childrenCreatedChannel}:`);
      lines.push(`    description: Fires when a child is created under a ${conceptPascal} node`);
      lines.push(`    messages:`);
      lines.push(`      ${toCamelCase(childrenCreatedMsg)}:`);
      lines.push(`        $ref: '#/components/messages/${childrenCreatedMsg}'`);

      // {concept}.{id}.moved channel (for reparent events)
      const movedChannel = `${conceptKebab}/{id}/moved`;
      const movedMsg = `${conceptPascal}Moved`;
      lines.push(`  ${movedChannel}:`);
      lines.push(`    description: Fires when a ${conceptPascal} node is reparented`);
      lines.push(`    messages:`);
      lines.push(`      ${toCamelCase(movedMsg)}:`);
      lines.push(`        $ref: '#/components/messages/${movedMsg}'`);
    }
    lines.push('');

    // --- Operations ---
    lines.push('operations:');
    for (const event of allEvents) {
      const operationId = `publish${event.messageName}`;
      lines.push(`  ${operationId}:`);
      lines.push(`    action: send`);
      lines.push(`    channel:`);
      lines.push(`      $ref: '#/channels/${event.channelId}'`);
      lines.push(`    summary: Publish event when ${toPascalCase(event.conceptName)}/${event.actionName} completes`);
      lines.push(`    messages:`);
      lines.push(`      - $ref: '#/channels/${event.channelId}/messages/${toCamelCase(event.messageName)}'`);
    }

    // @hierarchical: operations for hierarchy event channels
    for (const [conceptName] of hierConfigs) {
      const conceptKebab = toKebabCase(conceptName);
      const conceptPascal = toPascalCase(conceptName);

      const childrenCreatedChannel = `${conceptKebab}/{id}/children/created`;
      const childrenCreatedMsg = `${conceptPascal}ChildrenCreated`;
      lines.push(`  publish${childrenCreatedMsg}:`);
      lines.push(`    action: send`);
      lines.push(`    channel:`);
      lines.push(`      $ref: '#/channels/${childrenCreatedChannel}'`);
      lines.push(`    summary: Publish event when a child is created under ${conceptPascal}`);
      lines.push(`    messages:`);
      lines.push(`      - $ref: '#/channels/${childrenCreatedChannel}/messages/${toCamelCase(childrenCreatedMsg)}'`);

      const movedChannel = `${conceptKebab}/{id}/moved`;
      const movedMsg = `${conceptPascal}Moved`;
      lines.push(`  publish${movedMsg}:`);
      lines.push(`    action: send`);
      lines.push(`    channel:`);
      lines.push(`      $ref: '#/channels/${movedChannel}'`);
      lines.push(`    summary: Publish event when a ${conceptPascal} node is reparented`);
      lines.push(`    messages:`);
      lines.push(`      - $ref: '#/channels/${movedChannel}/messages/${toCamelCase(movedMsg)}'`);
    }
    lines.push('');
  }

  // --- Components ---
  lines.push('components:');

  // Messages
  if (allEvents.length > 0) {
    lines.push('  messages:');
    for (const event of allEvents) {
      lines.push(`    ${event.messageName}:`);
      lines.push(`      name: ${event.messageName}`);
      lines.push(`      title: ${toPascalCase(event.conceptName)} ${toPascalCase(event.eventVerb)} Event`);
      lines.push(`      contentType: application/json`);
      // @hierarchical: add parentPath header for events from hierarchical concepts
      if (hierConfigs.has(event.conceptName)) {
        lines.push(`      headers:`);
        lines.push(`        type: object`);
        lines.push(`        properties:`);
        lines.push(`          parentPath:`);
        lines.push(`            type: string`);
        lines.push(`            description: Materialized path from root to this node's parent`);
      }
      lines.push(`      payload:`);
      lines.push(`        $ref: '#/components/schemas/${event.schemaName}'`);
    }

    // @hierarchical: additional messages for hierarchy events
    for (const [conceptName] of hierConfigs) {
      const conceptPascal = toPascalCase(conceptName);

      // ChildrenCreated message
      const childrenCreatedMsg = `${conceptPascal}ChildrenCreated`;
      lines.push(`    ${childrenCreatedMsg}:`);
      lines.push(`      name: ${childrenCreatedMsg}`);
      lines.push(`      title: ${conceptPascal} Children Created Event`);
      lines.push(`      contentType: application/json`);
      lines.push(`      headers:`);
      lines.push(`        type: object`);
      lines.push(`        properties:`);
      lines.push(`          parentPath:`);
      lines.push(`            type: string`);
      lines.push(`            description: Materialized path from root to the parent node`);
      lines.push(`      payload:`);
      lines.push(`        $ref: '#/components/schemas/${childrenCreatedMsg}Payload'`);

      // Moved message
      const movedMsg = `${conceptPascal}Moved`;
      lines.push(`    ${movedMsg}:`);
      lines.push(`      name: ${movedMsg}`);
      lines.push(`      title: ${conceptPascal} Moved Event`);
      lines.push(`      contentType: application/json`);
      lines.push(`      headers:`);
      lines.push(`        type: object`);
      lines.push(`        properties:`);
      lines.push(`          parentPath:`);
      lines.push(`            type: string`);
      lines.push(`            description: Materialized path from root to the new parent node`);
      lines.push(`      payload:`);
      lines.push(`        $ref: '#/components/schemas/${movedMsg}Payload'`);
    }
    lines.push('');
  }

  // Schemas
  lines.push('  schemas:');

  for (const manifest of manifests) {
    const pascal = toPascalCase(manifest.name);

    // State schema
    const stateSchema = buildStateSchema(manifest);
    lines.push(`    ${pascal}:`);
    lines.push(indent(jsonToYaml(stateSchema, 0), 6));
  }

  // Event payload schemas
  for (const event of allEvents) {
    const payloadSchema = buildEventPayloadSchema(
      event.variant,
      event.conceptName,
      event.actionName,
    );
    lines.push(`    ${event.schemaName}:`);
    lines.push(indent(jsonToYaml(payloadSchema, 0), 6));
  }

  // @hierarchical: payload schemas for hierarchy events
  for (const [conceptName] of hierConfigs) {
    const conceptPascal = toPascalCase(conceptName);

    // ChildrenCreated payload
    const childrenCreatedPayload = {
      type: 'object',
      properties: {
        parentId: { type: 'string' },
        childId: { type: 'string' },
        parentPath: { type: 'string' },
      },
      required: ['parentId', 'childId'],
    };
    lines.push(`    ${conceptPascal}ChildrenCreatedPayload:`);
    lines.push(indent(jsonToYaml(childrenCreatedPayload, 0), 6));

    // Moved payload
    const movedPayload = {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        oldParentId: { type: 'string' },
        newParentId: { type: 'string' },
        oldParentPath: { type: 'string' },
        newParentPath: { type: 'string' },
      },
      required: ['nodeId', 'newParentId'],
    };
    lines.push(`    ${conceptPascal}MovedPayload:`);
    lines.push(indent(jsonToYaml(movedPayload, 0), 6));
  }

  // Action input/output schemas (for reference)
  for (const manifest of manifests) {
    const pascal = toPascalCase(manifest.name);
    for (const action of manifest.actions) {
      const actionPascal = toPascalCase(action.name);

      // Input schema
      if (action.params.length > 0) {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        for (const param of action.params) {
          properties[param.name] = typeToJsonSchema(param.type);
          required.push(param.name);
        }
        const inputSchema = {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        };
        lines.push(`    ${pascal}${actionPascal}Input:`);
        lines.push(indent(jsonToYaml(inputSchema, 0), 6));
      }

      // Variant output schemas
      for (const variant of action.variants) {
        const variantPascal = toPascalCase(variant.tag);
        const variantSchema = buildEventPayloadSchema(variant, manifest.name, action.name);
        lines.push(`    ${pascal}${actionPascal}${variantPascal}Response:`);
        lines.push(indent(jsonToYaml(variantSchema, 0), 6));
      }
    }
  }

  lines.push('');

  return lines.join('\n');
}

// --- Concept Handler ---

export const asyncapiTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'AsyncapiTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'AsyncApiSpec',
      capabilities: JSON.stringify(['asyncapi-3.0', 'yaml', 'channels']),
      targetKey: 'asyncapi',
      providerType: 'spec',
    };
  },

  /**
   * Generate an AsyncAPI 3.0 YAML document from all concept projections.
   *
   * Input fields:
   *   - allProjections: JSON string array of projection records
   *                     (each has conceptManifest as JSON string, conceptName, etc.)
   *   - config:         JSON string of event/messaging config
   *   - manifestYaml:   JSON string of the full parsed manifest YAML
   *
   * Returns variant 'ok' with a single asyncapi.yaml file and the document string.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // --- Parse allProjections ---

    const projectionsRaw = input.allProjections as string;
    if (!projectionsRaw || typeof projectionsRaw !== 'string') {
      return {
        variant: 'error',
        reason: 'allProjections is required and must be a JSON string',
      };
    }

    let projections: Record<string, unknown>[];
    try {
      projections = JSON.parse(projectionsRaw) as Record<string, unknown>[];
    } catch {
      return { variant: 'error', reason: 'allProjections is not valid JSON' };
    }

    if (!Array.isArray(projections) || projections.length === 0) {
      return {
        variant: 'error',
        reason: 'allProjections must be a non-empty array',
      };
    }

    // --- Parse config ---

    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as Record<string, unknown>;
      } catch {
        // Non-fatal: proceed with defaults
      }
    }

    // --- Parse manifestYaml ---

    let manifestYaml: Record<string, unknown> = {};
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        manifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch {
        // Non-fatal: proceed with defaults
      }
    }

    // --- Extract ConceptManifests from projections ---

    const manifests: ConceptManifest[] = [];

    for (const proj of projections) {
      const manifestStr = proj.conceptManifest as string;
      if (!manifestStr || typeof manifestStr !== 'string') {
        continue;
      }
      try {
        const manifest = JSON.parse(manifestStr) as ConceptManifest;
        if (manifest.name && manifest.actions) {
          manifests.push(manifest);
        }
      } catch {
        // Skip projections with invalid manifest JSON
        continue;
      }
    }

    if (manifests.length === 0) {
      return {
        variant: 'error',
        reason: 'No valid concept manifests found in projections',
      };
    }

    // --- Generate AsyncAPI document ---

    const document = assembleAsyncApiDocument(manifests, manifestYaml, config);

    return {
      variant: 'ok',
      files: [{ path: 'asyncapi.yaml', content: document }],
      document,
    };
  },
};
