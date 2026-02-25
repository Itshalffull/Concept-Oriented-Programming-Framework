// ============================================================
// MCP Target Provider Handler
//
// Generates MCP (Model Context Protocol) tool and resource
// definitions from concept projections. Each concept produces
// a single .tools.ts file containing typed tool, resource, and
// resource-template entries.
// Architecture doc: Interface Kit
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptManifest, ActionSchema, ActionParamSchema } from '../../../../kernel/src/types.js';
import { toKebabCase, toSnakeCase, typeToJsonSchema, inferMcpType, generateFileHeader, getHierarchicalTrait, getManifestEnrichment } from './codegen-utils.js';
import type { HierarchicalConfig } from './codegen-utils.js';
import { renderContent, interpolateVars } from './renderer.impl.js';

// --- MCP Entry Types ---

interface McpToolEntry {
  type: 'tool';
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpResourceEntry {
  type: 'resource';
  name: string;
  uri: string;
  description: string;
}

interface McpResourceTemplateEntry {
  type: 'resource-template';
  name: string;
  uriTemplate: string;
  description: string;
}

type McpEntry = McpToolEntry | McpResourceEntry | McpResourceTemplateEntry;

// --- Entry Builders ---

function buildToolEntry(
  conceptName: string,
  action: ActionSchema,
  overrideDesc?: string,
): McpToolEntry {
  const name = `${toSnakeCase(conceptName)}_${toSnakeCase(action.name)}`;
  const description = overrideDesc
    || `${action.variants[0]?.prose || `Execute ${action.name}`}`;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of action.params) {
    properties[param.name] = typeToJsonSchema(param.type);
    required.push(param.name);
  }

  return {
    type: 'tool' as const,
    name,
    description: `${toPascalLabel(action.name)} ${conceptName.toLowerCase()} — ${description}`,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

function buildResourceEntry(
  conceptName: string,
  action: ActionSchema,
  uriBase: string,
  overrideDesc?: string,
  overrideUri?: string,
): McpResourceEntry {
  const name = `${toSnakeCase(conceptName)}_${toSnakeCase(action.name)}`;
  const description = overrideDesc
    || `${action.variants[0]?.prose || `Execute ${action.name}`}`;

  // Build URI with path params from action params
  let uri = overrideUri || `${uriBase}/${toKebabCase(conceptName)}s`;
  if (action.params.length > 0) {
    const idParam = action.params[0];
    uri += `/{${idParam.name}}`;
  }

  return {
    type: 'resource' as const,
    name,
    uri,
    description: `${toPascalLabel(action.name)} ${conceptName.toLowerCase()} — ${description}`,
  };
}

function buildResourceTemplateEntry(
  conceptName: string,
  action: ActionSchema,
  uriBase: string,
  overrideDesc?: string,
  overrideUriTemplate?: string,
): McpResourceTemplateEntry {
  const name = `${toSnakeCase(conceptName)}_${toSnakeCase(action.name)}`;
  const description = overrideDesc
    || `${action.variants[0]?.prose || `Execute ${action.name}`}`;

  const uriTemplate = overrideUriTemplate || `${uriBase}/${toKebabCase(conceptName)}s`;

  return {
    type: 'resource-template' as const,
    name,
    uriTemplate,
    description: `${toPascalLabel(action.name)} ${conceptName.toLowerCase()} — ${description}`,
  };
}

/**
 * Convert an action name to a capitalised label.
 * "create" -> "Create", "addTag" -> "Add tag"
 */
function toPascalLabel(name: string): string {
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// --- Hierarchical Entry Builder ---

/**
 * Generate additional MCP tool entries for @hierarchical concepts.
 * Adds list_children, get_ancestors, and get_descendants tools.
 */
function buildHierarchicalEntries(conceptName: string): McpEntry[] {
  const snake = toSnakeCase(conceptName);
  return [
    {
      type: 'tool' as const,
      name: `${snake}_list_children`,
      description: `List direct children of a ${conceptName.toLowerCase()} node in the hierarchy`,
      inputSchema: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the parent node' },
          depth: { type: 'integer', description: 'Max depth to recurse (default: 1)' },
        },
        required: ['parentId'],
      },
    },
    {
      type: 'tool' as const,
      name: `${snake}_get_ancestors`,
      description: `Get the ancestor chain from a ${conceptName.toLowerCase()} node to the root`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the node' },
        },
        required: ['id'],
      },
    },
    {
      type: 'resource-template' as const,
      name: `${snake}_tree`,
      uriTemplate: `${toKebabCase(conceptName)}://{path}`,
      description: `Navigate the ${conceptName.toLowerCase()} hierarchy by path (e.g. root/sub1/sub2)`,
    },
  ];
}

// --- Generate Tools File ---

function generateToolsFile(
  manifest: ConceptManifest,
  conceptName: string,
  overrides: Record<string, Record<string, unknown>>,
  hierConfig?: HierarchicalConfig,
): string {
  const camel = conceptName.charAt(0).toLowerCase() + conceptName.slice(1);
  const uriBase = `${toKebabCase(manifest.uri?.split('/')[0] || conceptName)}:/`;
  const entries: McpEntry[] = [];

  for (const action of manifest.actions) {
    const actionOverride = overrides[action.name] || {};
    const overrideType = actionOverride.type as string | undefined;
    const overrideDesc = actionOverride.description as string | undefined;
    const overrideUri = actionOverride.uri as string | undefined;
    const overrideUriTemplate = actionOverride.uriTemplate as string | undefined;

    // Determine classification: use override if present, otherwise infer
    const mcpType = overrideType || inferMcpType(action.name);

    switch (mcpType) {
      case 'tool':
        entries.push(buildToolEntry(conceptName, action, overrideDesc));
        break;
      case 'resource':
        entries.push(buildResourceEntry(conceptName, action, uriBase, overrideDesc, overrideUri));
        break;
      case 'resource-template':
        entries.push(buildResourceTemplateEntry(conceptName, action, uriBase, overrideDesc, overrideUriTemplate));
        break;
      default:
        entries.push(buildToolEntry(conceptName, action, overrideDesc));
    }
  }

  // @hierarchical: add tree traversal tools
  if (hierConfig) {
    entries.push(...buildHierarchicalEntries(conceptName));
  }

  const lines: string[] = [];
  lines.push(generateFileHeader('mcp', conceptName));

  lines.push(`export const ${camel}Tools = ${JSON.stringify(entries, null, 2)};`);
  lines.push('');

  return lines.join('\n');
}

// --- MCP Help Markdown Generator ---

/**
 * Generate a mcp-help.md file with rendered enrichment content
 * (design principles, references, companion docs, etc.) using
 * the Renderer's mcp-help format.
 *
 * MCP uses {inputName} as its variable vocabulary for intro-template.
 */
function generateMcpHelpMd(
  manifest: ConceptManifest,
  conceptName: string,
  manifestYaml?: Record<string, unknown>,
): string | null {
  const enrichment = getManifestEnrichment(manifestYaml, conceptName);
  if (!enrichment || Object.keys(enrichment).length === 0) return null;

  const lines: string[] = [];
  const snake = toSnakeCase(conceptName);

  lines.push(`# ${snake} — MCP Tool Guide`);
  lines.push('');

  // Intro line with MCP variable vocabulary
  const introTemplate = enrichment['intro-template'] as string | undefined;
  if (introTemplate) {
    const vars: Record<string, string> = { ARGUMENTS: '{input}', CONCEPT: conceptName };
    lines.push(interpolateVars(introTemplate, vars));
    lines.push('');
    delete enrichment['intro-template'];
  } else {
    lines.push(manifest.purpose || `${conceptName} MCP tools.`);
    lines.push('');
  }

  const { output } = renderContent(enrichment, 'mcp-help');
  if (output) lines.push(output);

  return lines.join('\n');
}

// --- Concept Handler ---

export const mcpTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'McpTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'McpTools',
      capabilities: JSON.stringify(['tools', 'resources', 'resource-templates', 'hierarchical']),
      targetKey: 'mcp',
      providerType: 'target',
    };
  },

  /**
   * Generate MCP tool/resource definition files for one or more concepts.
   *
   * Actions are classified as tool (side-effecting), resource (read-only
   * with ID parameter), or resource-template (read-only list). Override
   * classification via the overrides input.
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

    // Parse overrides
    let overrides: Record<string, Record<string, unknown>> = {};
    if (overridesRaw && typeof overridesRaw === 'string') {
      try {
        overrides = JSON.parse(overridesRaw) as Record<string, Record<string, unknown>>;
      } catch {
        // Ignore malformed overrides
      }
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
    const content = generateToolsFile(manifest, name, overrides, hierConfig);

    const files: Array<{ path: string; content: string }> = [
      {
        path: `${kebab}/${kebab}.tools.ts`,
        content,
      },
    ];

    // Emit enrichment-driven MCP help documentation if available
    const helpMd = generateMcpHelpMd(manifest, name, parsedManifestYaml);
    if (helpMd) {
      files.push({
        path: `${kebab}/${kebab}.help.md`,
        content: helpMd,
      });
    }

    return { variant: 'ok', files };
  },
};
