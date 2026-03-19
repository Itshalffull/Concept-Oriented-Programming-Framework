// ============================================================
// OpenAI Function-Calling Target Provider Handler
//
// Generates OpenAI-compatible function-calling tool definitions
// from concept projections. Each concept produces a .functions.ts
// file containing typed function definitions suitable for the
// OpenAI Chat Completions API tools parameter, Google Gemini,
// and any function-calling LLM API.
//
// Supports strict mode (additionalProperties: false) for
// OpenAI structured outputs.
// Architecture doc: Clef Bind
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptManifest, ActionSchema } from '../../../../runtime/types.js';
import { toKebabCase, toSnakeCase, typeToJsonSchema, generateFileHeader, getHierarchicalTrait, getManifestEnrichment } from './codegen-utils.js';
import type { HierarchicalConfig } from './codegen-utils.js';
import { renderContent, interpolateVars } from './renderer.handler.js';

// --- OpenAI Function Definition Types ---

interface OpenAiFunctionDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    strict?: boolean;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
}

// --- Function Definition Builders ---

/**
 * Build an OpenAI function definition from a concept action.
 *
 * The function name uses snake_case: concept_action (e.g. score_api_list_concepts).
 * The description combines the action prose and concept context for
 * optimal LLM tool selection.
 * In strict mode, additionalProperties is false and all params are required.
 */
function buildFunctionDef(
  conceptName: string,
  action: ActionSchema,
  strict: boolean,
  overrideDesc?: string,
): OpenAiFunctionDef {
  const name = `${toSnakeCase(conceptName)}_${toSnakeCase(action.name)}`;

  // Build description: action prose gives the best LLM context
  const actionProse = action.variants[0]?.prose || `Execute ${action.name}`;
  const description = overrideDesc || actionProse;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of action.params) {
    const schema = typeToJsonSchema(param.type);
    // Add parameter description from the param name for LLM comprehension
    (schema as Record<string, unknown>).description = formatParamDescription(param.name, param.type);
    properties[param.name] = schema;
    required.push(param.name);
  }

  const parameters: OpenAiFunctionDef['function']['parameters'] = {
    type: 'object',
    properties,
    required,
  };

  if (strict) {
    parameters.additionalProperties = false;
  }

  return {
    type: 'function',
    function: {
      name,
      description: truncateDescription(description, 1024),
      ...(strict ? { strict: true } : {}),
      parameters,
    },
  };
}

/**
 * Format a human-readable parameter description from the param name and type.
 */
function formatParamDescription(name: string, type: { kind: string; primitive?: string }): string {
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const article = /^[aeiou]/.test(spaced) ? 'An' : 'A';
  const typeHint = type.kind === 'primitive' ? ` (${(type.primitive || '').toLowerCase()})` : '';
  return `${article} ${spaced}${typeHint}`;
}

/**
 * Truncate a description to fit within OpenAI's recommended limits.
 */
function truncateDescription(desc: string, maxLen: number): string {
  const cleaned = desc.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + '...';
}

// --- Hierarchical Function Builders ---

/**
 * Generate additional function definitions for @hierarchical concepts.
 */
function buildHierarchicalFunctions(conceptName: string, strict: boolean): OpenAiFunctionDef[] {
  const snake = toSnakeCase(conceptName);

  const childrenParams: OpenAiFunctionDef['function']['parameters'] = {
    type: 'object',
    properties: {
      parentId: { type: 'string', description: 'ID of the parent node' },
      depth: { type: 'integer', description: 'Max depth to recurse (default: 1)' },
    },
    required: ['parentId'],
  };

  const ancestorsParams: OpenAiFunctionDef['function']['parameters'] = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'ID of the node' },
    },
    required: ['id'],
  };

  if (strict) {
    childrenParams.additionalProperties = false;
    childrenParams.required = ['parentId', 'depth'];
    ancestorsParams.additionalProperties = false;
  }

  return [
    {
      type: 'function',
      function: {
        name: `${snake}_list_children`,
        description: `List direct children of a ${conceptName.toLowerCase()} node in the hierarchy`,
        ...(strict ? { strict: true } : {}),
        parameters: childrenParams,
      },
    },
    {
      type: 'function',
      function: {
        name: `${snake}_get_ancestors`,
        description: `Get the ancestor chain from a ${conceptName.toLowerCase()} node to the root`,
        ...(strict ? { strict: true } : {}),
        parameters: ancestorsParams,
      },
    },
  ];
}

// --- Generate Functions File ---

function generateFunctionsFile(
  manifest: ConceptManifest,
  conceptName: string,
  overrides: Record<string, Record<string, unknown>>,
  strict: boolean,
  hierConfig?: HierarchicalConfig,
): string {
  const camel = conceptName.charAt(0).toLowerCase() + conceptName.slice(1);
  const functions: OpenAiFunctionDef[] = [];

  for (const action of manifest.actions) {
    const actionOverride = overrides[action.name] || {};
    const overrideDesc = actionOverride.description as string | undefined;
    functions.push(buildFunctionDef(conceptName, action, strict, overrideDesc));
  }

  // @hierarchical: add tree traversal functions
  if (hierConfig) {
    functions.push(...buildHierarchicalFunctions(conceptName, strict));
  }

  const lines: string[] = [];
  lines.push(generateFileHeader('openai', conceptName));
  lines.push('');
  lines.push('/**');
  lines.push(` * OpenAI function-calling tool definitions for ${conceptName}.`);
  lines.push(' * Pass these to the OpenAI Chat Completions API tools parameter,');
  lines.push(' * or to any compatible function-calling LLM API (Gemini, etc.).');
  lines.push(' *');
  lines.push(` * ${strict ? 'Strict mode enabled: all parameters required, no additional properties.' : 'Non-strict mode: optional parameters allowed.'}`);
  lines.push(' */');
  lines.push(`export const ${camel}Functions = ${JSON.stringify(functions, null, 2)} as const;`);
  lines.push('');
  lines.push(`export type ${conceptName}FunctionName = typeof ${camel}Functions[number]['function']['name'];`);
  lines.push('');

  return lines.join('\n');
}

// --- OpenAI Help Markdown Generator ---

function generateOpenAiHelpMd(
  manifest: ConceptManifest,
  conceptName: string,
  manifestYaml?: Record<string, unknown>,
): string | null {
  const enrichment = getManifestEnrichment(manifestYaml, conceptName);
  if (!enrichment || Object.keys(enrichment).length === 0) return null;

  const lines: string[] = [];
  const snake = toSnakeCase(conceptName);

  lines.push(`# ${snake} — OpenAI Function-Calling Guide`);
  lines.push('');

  const introTemplate = enrichment['intro-template'] as string | undefined;
  if (introTemplate) {
    const vars: Record<string, string> = { ARGUMENTS: '{parameters}', CONCEPT: conceptName };
    lines.push(interpolateVars(introTemplate, vars));
    lines.push('');
    delete enrichment['intro-template'];
  } else {
    lines.push(manifest.purpose || `${conceptName} OpenAI functions.`);
    lines.push('');
  }

  const { output } = renderContent(enrichment, 'openai-help');
  if (output) lines.push(output);

  return lines.join('\n');
}

// --- Concept Handler ---

export const openaiTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'OpenaiTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'OpenAiFunctions',
      capabilities: JSON.stringify(['function-calling', 'strict-mode', 'hierarchical']),
      targetKey: 'openai',
      providerType: 'target',
    };
  },

  /**
   * Generate OpenAI function-calling definition files for one or more concepts.
   *
   * Each concept action becomes a function definition with typed JSON Schema
   * parameters and a description optimized for LLM tool selection.
   *
   * Config options:
   *   strict (boolean): Enable strict mode (additionalProperties: false). Default: true.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const projectionRaw = input.projection as string;
    const overridesRaw = input.overrides as string | undefined;

    if (!projectionRaw || typeof projectionRaw !== 'string') {
      return { variant: 'ok', files: [] };
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw);
    } catch {
      return { variant: 'ok', files: [] };
    }

    const manifestRaw = projection.conceptManifest as string | Record<string, unknown>;
    const conceptName = projection.conceptName as string;

    let manifest: ConceptManifest;
    if (typeof manifestRaw === 'string') {
      try {
        manifest = JSON.parse(manifestRaw) as ConceptManifest;
      } catch {
        return { variant: 'ok', files: [] };
      }
    } else {
      manifest = manifestRaw as ConceptManifest;
    }

    // Parse config
    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as Record<string, unknown>;
      } catch { /* use defaults */ }
    }

    const strict = config.strict !== false; // Default: true

    // Parse overrides
    let overrides: Record<string, Record<string, unknown>> = {};
    if (overridesRaw && typeof overridesRaw === 'string') {
      try {
        overrides = JSON.parse(overridesRaw) as Record<string, Record<string, unknown>>;
      } catch { /* ignore */ }
    }

    const name = conceptName || manifest.name;
    let parsedManifestYaml: Record<string, unknown> | undefined;
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        parsedManifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    const hierConfig = getHierarchicalTrait(parsedManifestYaml, name);
    const kebab = toKebabCase(name);
    const content = generateFunctionsFile(manifest, name, overrides, strict, hierConfig);

    const files: Array<{ path: string; content: string }> = [
      {
        path: `${kebab}/${kebab}.functions.ts`,
        content,
      },
    ];

    // Emit enrichment-driven OpenAI help documentation if available
    const helpMd = generateOpenAiHelpMd(manifest, name, parsedManifestYaml);
    if (helpMd) {
      files.push({
        path: `${kebab}/${kebab}.openai-help.md`,
        content: helpMd,
      });
    }

    return { variant: 'ok', files };
  },
};
