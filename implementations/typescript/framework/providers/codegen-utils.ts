// ============================================================
// Shared Code Generation Utilities
//
// Type mapping, naming conventions, and resource inference
// helpers used by all interface provider handlers.
// Architecture doc: Interface Kit
// ============================================================

import type { ResolvedType, ActionSchema, ConceptManifest } from '../../../../kernel/src/types.js';

// --- Type Mapping Functions ---

export function typeToTypeScript(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'string';
        case 'Int': return 'number';
        case 'Float': return 'number';
        case 'Bool': return 'boolean';
        case 'DateTime': return 'string';
        default: return 'string';
      }
    case 'param': return 'string';
    case 'set': return `Set<${typeToTypeScript(type.inner)}>`;
    case 'list': return `${typeToTypeScript(type.inner)}[]`;
    case 'option': return `${typeToTypeScript(type.inner)} | null`;
    case 'map': return `Map<${typeToTypeScript(type.keyType)}, ${typeToTypeScript(type.inner)}>`;
    case 'record':
      return `{ ${type.fields.map(f => `${f.name}: ${typeToTypeScript(f.type)}`).join('; ')} }`;
  }
}

export function typeToPython(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'str';
        case 'Int': return 'int';
        case 'Float': return 'float';
        case 'Bool': return 'bool';
        case 'DateTime': return 'str';
        default: return 'str';
      }
    case 'param': return 'str';
    case 'set': return `set[${typeToPython(type.inner)}]`;
    case 'list': return `list[${typeToPython(type.inner)}]`;
    case 'option': return `Optional[${typeToPython(type.inner)}]`;
    case 'map': return `dict[${typeToPython(type.keyType)}, ${typeToPython(type.inner)}]`;
    case 'record':
      return `dict`;
  }
}

export function typeToGo(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'string';
        case 'Int': return 'int64';
        case 'Float': return 'float64';
        case 'Bool': return 'bool';
        case 'DateTime': return 'time.Time';
        default: return 'string';
      }
    case 'param': return 'string';
    case 'set': return `[]${typeToGo(type.inner)}`;
    case 'list': return `[]${typeToGo(type.inner)}`;
    case 'option': return `*${typeToGo(type.inner)}`;
    case 'map': return `map[${typeToGo(type.keyType)}]${typeToGo(type.inner)}`;
    case 'record': return 'map[string]interface{}';
  }
}

export function typeToRust(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'String';
        case 'Int': return 'i64';
        case 'Float': return 'f64';
        case 'Bool': return 'bool';
        case 'DateTime': return 'String';
        default: return 'String';
      }
    case 'param': return 'String';
    case 'set': return `HashSet<${typeToRust(type.inner)}>`;
    case 'list': return `Vec<${typeToRust(type.inner)}>`;
    case 'option': return `Option<${typeToRust(type.inner)}>`;
    case 'map': return `HashMap<${typeToRust(type.keyType)}, ${typeToRust(type.inner)}>`;
    case 'record': return 'serde_json::Value';
  }
}

export function typeToJava(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'String';
        case 'Int': return 'Long';
        case 'Float': return 'Double';
        case 'Bool': return 'Boolean';
        case 'DateTime': return 'String';
        default: return 'String';
      }
    case 'param': return 'String';
    case 'set': return `Set<${typeToJava(type.inner)}>`;
    case 'list': return `List<${typeToJava(type.inner)}>`;
    case 'option': return typeToJava(type.inner);
    case 'map': return `Map<${typeToJava(type.keyType)}, ${typeToJava(type.inner)}>`;
    case 'record': return 'Map<String, Object>';
  }
}

export function typeToSwift(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'String';
        case 'Int': return 'Int64';
        case 'Float': return 'Double';
        case 'Bool': return 'Bool';
        case 'DateTime': return 'String';
        default: return 'String';
      }
    case 'param': return 'String';
    case 'set': return `Set<${typeToSwift(type.inner)}>`;
    case 'list': return `[${typeToSwift(type.inner)}]`;
    case 'option': return `${typeToSwift(type.inner)}?`;
    case 'map': return `[${typeToSwift(type.keyType)}: ${typeToSwift(type.inner)}]`;
    case 'record': return '[String: Any]';
  }
}

export function typeToProtobuf(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'string';
        case 'Int': return 'int64';
        case 'Float': return 'double';
        case 'Bool': return 'bool';
        case 'DateTime': return 'string';
        default: return 'string';
      }
    case 'param': return 'string';
    case 'set':
    case 'list': return `repeated ${typeToProtobuf(type.inner)}`;
    case 'option': return `optional ${typeToProtobuf(type.inner)}`;
    case 'map': return `map<${typeToProtobuf(type.keyType)}, ${typeToProtobuf(type.inner)}>`;
    case 'record': return 'google.protobuf.Struct';
  }
}

export function typeToGraphQL(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return 'String';
        case 'Int': return 'Int';
        case 'Float': return 'Float';
        case 'Bool': return 'Boolean';
        case 'DateTime': return 'String';
        default: return 'String';
      }
    case 'param': return 'ID';
    case 'set':
    case 'list': return `[${typeToGraphQL(type.inner)}]`;
    case 'option': return typeToGraphQL(type.inner);
    case 'map': return 'JSON';
    case 'record': return 'JSON';
  }
}

export function typeToJsonSchema(type: ResolvedType): Record<string, unknown> {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'String': return { type: 'string' };
        case 'Int': return { type: 'integer' };
        case 'Float': return { type: 'number' };
        case 'Bool': return { type: 'boolean' };
        case 'DateTime': return { type: 'string', format: 'date-time' };
        default: return { type: 'string' };
      }
    case 'param': return { type: 'string' };
    case 'set':
    case 'list': return { type: 'array', items: typeToJsonSchema(type.inner) };
    case 'option': return { oneOf: [typeToJsonSchema(type.inner), { type: 'null' }] };
    case 'map': return { type: 'object', additionalProperties: typeToJsonSchema(type.inner) };
    case 'record':
      return {
        type: 'object',
        properties: Object.fromEntries(type.fields.map(f => [f.name, typeToJsonSchema(f.type)])),
        required: type.fields.filter(f => !f.optional).map(f => f.name),
      };
  }
}

// --- Resource Inference ---

export interface HttpRoute {
  method: string;
  path: string;
  statusCodes: { ok: number; notFound?: number; error?: number };
}

/**
 * Infer HTTP method and path from action name.
 * create/add/new → POST, get/find/read → GET, list/all/search → GET,
 * update/edit/modify → PUT, delete/remove → DELETE, other → POST
 */
export function inferHttpRoute(actionName: string, basePath: string): HttpRoute {
  const name = actionName.toLowerCase();

  if (name.startsWith('create') || name.startsWith('add') || name.startsWith('new')) {
    return { method: 'POST', path: basePath, statusCodes: { ok: 201 } };
  }
  if (name.startsWith('get') || name.startsWith('find') || name.startsWith('read') || name.startsWith('lookup')) {
    return { method: 'GET', path: `${basePath}/{id}`, statusCodes: { ok: 200, notFound: 404 } };
  }
  if (name.startsWith('list') || name.startsWith('all') || name.startsWith('search')) {
    return { method: 'GET', path: basePath, statusCodes: { ok: 200 } };
  }
  if (name.startsWith('update') || name.startsWith('edit') || name.startsWith('modify')) {
    return { method: 'PUT', path: `${basePath}/{id}`, statusCodes: { ok: 200, notFound: 404 } };
  }
  if (name.startsWith('delete') || name.startsWith('remove')) {
    return { method: 'DELETE', path: `${basePath}/{id}`, statusCodes: { ok: 200, notFound: 404 } };
  }
  return { method: 'POST', path: `${basePath}/{id}/${toKebabCase(actionName)}`, statusCodes: { ok: 200 } };
}

/** Classify action for GraphQL: mutation (side-effecting) or query (read-only). */
export function inferGraphqlOp(actionName: string): 'query' | 'mutation' {
  const name = actionName.toLowerCase();
  if (name.startsWith('get') || name.startsWith('list') || name.startsWith('find') ||
      name.startsWith('search') || name.startsWith('all') || name.startsWith('read') ||
      name.startsWith('lookup') || name.startsWith('is') || name.startsWith('count')) {
    return 'query';
  }
  return 'mutation';
}

/** Classify action for MCP: tool (side-effecting), resource (read-only+ID), resource-template (list). */
export function inferMcpType(actionName: string): 'tool' | 'resource' | 'resource-template' {
  const name = actionName.toLowerCase();
  if (name.startsWith('list') || name.startsWith('all') || name.startsWith('search')) {
    return 'resource-template';
  }
  if (name.startsWith('get') || name.startsWith('find') || name.startsWith('read') ||
      name.startsWith('lookup') || name.startsWith('is') || name.startsWith('count')) {
    return 'resource';
  }
  return 'tool';
}

// --- Naming Helpers ---

export function toKebabCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

export function toPascalCase(s: string): string {
  return s.replace(/(^|[-_\s])(\w)/g, (_, __, c: string) => c.toUpperCase());
}

export function toSnakeCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
}

export function toCamelCase(s: string): string {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// --- File Header ---

export function generateFileHeader(target: string, conceptName: string): string {
  return `// Auto-generated by COPF Interface Kit — ${target} target\n// Concept: ${conceptName}\n// Do not edit manually; regenerate with: copf interface generate\n`;
}

// --- Manifest Extraction Helpers ---

/**
 * Extract action override config from the parsed YAML manifest
 * for a specific concept and target.
 */
export function getActionOverrides(
  manifestYaml: Record<string, unknown>,
  conceptName: string,
  target: string,
): Record<string, Record<string, unknown>> {
  const concepts = manifestYaml.concepts as Record<string, Record<string, unknown>> | undefined;
  if (!concepts) return {};
  const conceptConfig = concepts[conceptName];
  if (!conceptConfig) return {};
  const targetConfig = conceptConfig[target] as Record<string, unknown> | undefined;
  if (!targetConfig) return {};
  return (targetConfig.actions as Record<string, Record<string, unknown>>) || {};
}

/** Get base path override for a concept's REST target. */
export function getRestBasePath(
  manifestYaml: Record<string, unknown>,
  conceptName: string,
  defaultBasePath: string,
): string {
  const concepts = manifestYaml.concepts as Record<string, Record<string, unknown>> | undefined;
  if (!concepts) return defaultBasePath;
  const conceptConfig = concepts[conceptName];
  if (!conceptConfig) return defaultBasePath;
  const restConfig = conceptConfig.rest as Record<string, unknown> | undefined;
  if (!restConfig) return defaultBasePath;
  return (restConfig.path as string) || defaultBasePath;
}

/** Get the global API base path from the manifest's targets.rest config. */
export function getApiBasePath(manifestYaml: Record<string, unknown>): string {
  const targets = manifestYaml.targets as Record<string, Record<string, unknown>> | undefined;
  if (!targets?.rest) return '/api';
  return (targets.rest.basePath as string) || '/api';
}

// --- Action Classification ---

/** Unified classification of a single action by its operational properties. */
export interface ActionClassification {
  crudRole: 'create' | 'read' | 'update' | 'delete' | 'other';
  intent: 'read' | 'write';
  eventProducing: boolean;
  eventVerb: string;
  mcpType: 'tool' | 'resource' | 'resource-template';
}

/**
 * Classify a single action name by its operational properties.
 * Consolidates logic from inferHttpRoute (CRUD role), inferGraphqlOp (intent),
 * asyncapi-target (event classification), and inferMcpType (MCP type).
 */
export function classifyAction(actionName: string): ActionClassification {
  const name = actionName.toLowerCase();

  // CRUD role (extracted from inferHttpRoute pattern)
  let crudRole: ActionClassification['crudRole'] = 'other';
  if (name.startsWith('create') || name.startsWith('add') || name.startsWith('new')) {
    crudRole = 'create';
  } else if (
    name.startsWith('get') || name.startsWith('find') || name.startsWith('read') ||
    name.startsWith('lookup') || name.startsWith('list') || name.startsWith('all') ||
    name.startsWith('search') || name.startsWith('is') || name.startsWith('count')
  ) {
    crudRole = 'read';
  } else if (name.startsWith('update') || name.startsWith('edit') || name.startsWith('modify')) {
    crudRole = 'update';
  } else if (name.startsWith('delete') || name.startsWith('remove')) {
    crudRole = 'delete';
  }

  // Intent (reuses inferGraphqlOp logic)
  const intent: ActionClassification['intent'] =
    inferGraphqlOp(actionName) === 'query' ? 'read' : 'write';

  // Event producing (side-effecting actions produce events)
  const eventProducing = intent === 'write';

  // Event verb (moved from asyncapi-target deriveEventVerb)
  let eventVerb: string;
  if (name.startsWith('create') || name.startsWith('add') || name.startsWith('new')) {
    eventVerb = 'created';
  } else if (name.startsWith('update') || name.startsWith('edit') || name.startsWith('modify')) {
    eventVerb = 'updated';
  } else if (name.startsWith('delete') || name.startsWith('remove')) {
    eventVerb = 'deleted';
  } else {
    eventVerb = `${toCamelCase(actionName)}Completed`;
  }

  // MCP type (reuses inferMcpType)
  const mcpType = inferMcpType(actionName);

  return { crudRole, intent, eventProducing, eventVerb, mcpType };
}

// --- Hierarchical Trait Detection ---

/** Trait config from manifest YAML concepts.{name}.traits */
export interface TraitConfig {
  name: string;
  config?: Record<string, unknown>;
  actions?: string[] | ['all'];
}

/** Parsed @hierarchical trait config. */
export interface HierarchicalConfig {
  relation: string;
  labelField?: string;
  maxDepth?: number;
  style: 'nested' | 'prefixed';
}

/**
 * Extract the @hierarchical trait from a concept's traits array.
 * Returns undefined if not present.
 */
export function getHierarchicalTrait(
  manifestYaml: Record<string, unknown> | undefined,
  conceptName: string,
): HierarchicalConfig | undefined {
  if (!manifestYaml) return undefined;
  const concepts = manifestYaml.concepts as Record<string, Record<string, unknown>> | undefined;
  if (!concepts?.[conceptName]) return undefined;
  const traits = concepts[conceptName].traits as TraitConfig[] | undefined;
  if (!traits) return undefined;
  const hier = traits.find(t => t.name === 'hierarchical');
  if (!hier?.config) return undefined;
  return {
    relation: (hier.config.relation as string) || 'parentOf',
    labelField: hier.config.labelField as string | undefined,
    maxDepth: hier.config.maxDepth as number | undefined,
    style: (hier.config.style as 'nested' | 'prefixed') || 'nested',
  };
}

/**
 * Infer additional hierarchical HTTP routes for a concept.
 * Returns routes for children, ancestors, descendants, and move endpoints.
 */
export function inferHierarchicalRoutes(basePath: string): HttpRoute[] {
  return [
    { method: 'GET', path: `${basePath}/{id}/children`, statusCodes: { ok: 200, notFound: 404 } },
    { method: 'POST', path: `${basePath}/{id}/children`, statusCodes: { ok: 201, notFound: 404 } },
    { method: 'GET', path: `${basePath}/{id}/ancestors`, statusCodes: { ok: 200, notFound: 404 } },
    { method: 'GET', path: `${basePath}/{id}/descendants`, statusCodes: { ok: 200, notFound: 404 } },
  ];
}

/**
 * Get enrichment content from a parsed projection's content field.
 * Returns an empty object if no content is available.
 */
export function getEnrichmentContent(
  projection: Record<string, unknown>,
): Record<string, unknown> {
  const contentStr = projection.content as string | undefined;
  if (!contentStr) return {};
  try {
    return JSON.parse(contentStr) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// --- Concept Grouping ---

export type GroupingMode =
  | 'per-concept'
  | 'per-kit'
  | 'single'
  | 'custom'
  | 'by-crud'
  | 'by-intent'
  | 'by-event'
  | 'by-mcp-type';

export interface GroupingConfig {
  strategy: GroupingMode;
  name?: string;
  custom?: Record<string, { concepts: string[]; description?: string }>;
}

export interface ConceptGroup {
  name: string;
  description: string;
  concepts: ConceptManifest[];
}

/**
 * Determine the dominant classification value for a concept's actions.
 * Uses majority-vote; ties broken alphabetically for determinism.
 */
function getDominantClassification(
  manifest: ConceptManifest,
  property: keyof ActionClassification,
): string {
  const counts = new Map<string, number>();
  for (const action of manifest.actions) {
    const classification = classifyAction(action.name);
    const value = String(classification[property]);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let maxCount = 0;
  let dominant = 'mixed';
  for (const [value, count] of counts) {
    if (count > maxCount || (count === maxCount && value < dominant)) {
      maxCount = count;
      dominant = value;
    }
  }
  return dominant;
}

/**
 * Organize concepts into named groups using the configured strategy.
 * Structural strategies: per-concept, per-kit, single, custom.
 * Behavioral strategies: by-crud, by-intent, by-event, by-mcp-type.
 */
export function buildConceptGroups(
  manifests: ConceptManifest[],
  config: GroupingConfig,
): ConceptGroup[] {
  switch (config.strategy) {
    // --- Structural strategies ---
    case 'per-concept':
      return manifests.map((m) => ({
        name: toKebabCase(m.name),
        description: m.purpose || `Manage ${m.name} resources`,
        concepts: [m],
      }));

    case 'per-kit': {
      const kitMap = new Map<string, ConceptManifest[]>();
      for (const m of manifests) {
        const kit = (m as Record<string, unknown>).kit as string
          || `${config.name || 'app'}-misc`;
        const arr = kitMap.get(kit) || [];
        arr.push(m);
        kitMap.set(kit, arr);
      }
      return Array.from(kitMap.entries()).map(([kit, concepts]) => ({
        name: toKebabCase(kit),
        description: `${toPascalCase(kit)} — ${concepts.map((c) => c.name).join(', ')}`,
        concepts,
      }));
    }

    case 'single':
      return [{
        name: toKebabCase(config.name || 'app'),
        description: `${toPascalCase(config.name || 'app')} — ${manifests.map((c) => c.name).join(', ')}`,
        concepts: manifests,
      }];

    case 'custom': {
      if (!config.custom) {
        return manifests.map((m) => ({
          name: toKebabCase(m.name),
          description: m.purpose || `Manage ${m.name} resources`,
          concepts: [m],
        }));
      }
      const groups: ConceptGroup[] = [];
      const assigned = new Set<string>();
      for (const [groupName, groupDef] of Object.entries(config.custom)) {
        const conceptNames = groupDef.concepts || [];
        const grouped = manifests.filter((m) => conceptNames.includes(m.name));
        for (const m of grouped) assigned.add(m.name);
        if (grouped.length > 0) {
          groups.push({
            name: toKebabCase(groupName),
            description: groupDef.description
              || `${toPascalCase(groupName)} — ${grouped.map((c) => c.name).join(', ')}`,
            concepts: grouped,
          });
        }
      }
      // Ungrouped concepts fall back to per-concept
      for (const m of manifests) {
        if (!assigned.has(m.name)) {
          groups.push({
            name: toKebabCase(m.name),
            description: m.purpose || `Manage ${m.name} resources`,
            concepts: [m],
          });
        }
      }
      return groups;
    }

    // --- Behavioral strategies ---
    case 'by-crud': {
      const buckets = new Map<string, ConceptManifest[]>();
      for (const m of manifests) {
        const dominant = getDominantClassification(m, 'crudRole');
        const arr = buckets.get(dominant) || [];
        arr.push(m);
        buckets.set(dominant, arr);
      }
      return Array.from(buckets.entries()).map(([role, concepts]) => ({
        name: role,
        description: `${toPascalCase(role)} operations — ${concepts.map((c) => c.name).join(', ')}`,
        concepts,
      }));
    }

    case 'by-intent': {
      const buckets = new Map<string, ConceptManifest[]>();
      for (const m of manifests) {
        const dominant = getDominantClassification(m, 'intent');
        const arr = buckets.get(dominant) || [];
        arr.push(m);
        buckets.set(dominant, arr);
      }
      return Array.from(buckets.entries()).map(([intent, concepts]) => ({
        name: intent,
        description: `${toPascalCase(intent)} concepts — ${concepts.map((c) => c.name).join(', ')}`,
        concepts,
      }));
    }

    case 'by-event': {
      const producing: ConceptManifest[] = [];
      const nonProducing: ConceptManifest[] = [];
      for (const m of manifests) {
        const hasEvents = m.actions.some((a) => classifyAction(a.name).eventProducing);
        (hasEvents ? producing : nonProducing).push(m);
      }
      const groups: ConceptGroup[] = [];
      if (producing.length > 0) {
        groups.push({
          name: 'event-producing',
          description: `Event-producing concepts — ${producing.map((c) => c.name).join(', ')}`,
          concepts: producing,
        });
      }
      if (nonProducing.length > 0) {
        groups.push({
          name: 'read-only',
          description: `Read-only concepts — ${nonProducing.map((c) => c.name).join(', ')}`,
          concepts: nonProducing,
        });
      }
      return groups;
    }

    case 'by-mcp-type': {
      const buckets = new Map<string, ConceptManifest[]>();
      for (const m of manifests) {
        const dominant = getDominantClassification(m, 'mcpType');
        const arr = buckets.get(dominant) || [];
        arr.push(m);
        buckets.set(dominant, arr);
      }
      return Array.from(buckets.entries()).map(([type, concepts]) => ({
        name: type,
        description: `${toPascalCase(type)} concepts — ${concepts.map((c) => c.name).join(', ')}`,
        concepts,
      }));
    }

    default:
      return manifests.map((m) => ({
        name: toKebabCase(m.name),
        description: m.purpose || `Manage ${m.name} resources`,
        concepts: [m],
      }));
  }
}
