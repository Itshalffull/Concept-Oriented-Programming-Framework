// ============================================================
// CLI Target Provider Handler
//
// Generates Commander.js command definitions from concept
// projections. Each concept produces a .command.ts file with
// subcommands for every action, and a command tree structure
// with help text, examples, and argument mappings.
// Architecture doc: Interface Kit, Section 2.4
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptManifest, ActionSchema, ActionParamSchema } from '../../../../kernel/src/types.js';
import { toKebabCase, toCamelCase, generateFileHeader, getHierarchicalTrait, getManifestEnrichment } from './codegen-utils.js';
import type { HierarchicalConfig } from './codegen-utils.js';
import { renderContent, interpolateVars } from './renderer.impl.js';

// --- CLI Command Tree Metadata Types ---

/** Action-level CLI override from manifest YAML. */
interface CliActionMapping {
  command?: string;
  description?: string;
  args?: Record<string, { positional?: boolean; choices?: string[]; default?: string; short?: string }>;
  flags?: Record<string, { type?: string; required?: boolean; description?: string; short?: string; choices?: string[]; default?: string }>;
  examples?: Array<{ description: string; command: string }>;
  'see-also'?: string[];
}

/** Concept-level CLI config from manifest YAML. */
interface CliConceptConfig {
  actions?: Record<string, CliActionMapping>;
  'command-group'?: string;
  description?: string;
  examples?: Array<{ description: string; command: string }>;
}

// --- Option Inference ---

/**
 * Derive a short human-readable label from a parameter name.
 * Converts camelCase to separate capitalised words.
 */
function paramLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

/**
 * Determine whether a CLI option should use a value placeholder
 * (always true for primitive types; false only for boolean flags
 * when emitted explicitly, which we do not do here).
 */
function optionValueTag(param: ActionParamSchema): string {
  return `<${param.name}>`;
}

/** Get CLI config for a concept from manifestYaml.
 *  Checks both 'concepts' (conduit-style: config objects keyed by name)
 *  and 'concept-overrides' (devtools-style: separate overrides key). */
function getCliConfig(
  manifestYaml: Record<string, unknown> | undefined,
  conceptName: string,
): CliConceptConfig | undefined {
  if (!manifestYaml) return undefined;
  const concepts = manifestYaml.concepts as Record<string, Record<string, unknown>> | undefined;
  const conceptOverrides = manifestYaml['concept-overrides'] as Record<string, Record<string, unknown>> | undefined;
  const conceptConfig = concepts?.[conceptName] || conceptOverrides?.[conceptName];
  if (!conceptConfig) return undefined;
  return conceptConfig.cli as CliConceptConfig | undefined;
}

// --- Hierarchical Support ---

/**
 * Generate a `tree` subcommand that displays the full hierarchy
 * with optional --depth flag to limit levels.
 */
function buildTreeSubcommand(conceptCamel: string): string {
  const lines: string[] = [];
  lines.push(`${conceptCamel}Command`);
  lines.push(`  .command('tree')`);
  lines.push(`  .description('Display the full hierarchy as an indented tree')`);
  lines.push(`  .option('--depth <depth>', 'Maximum depth to display', parseInt)`);
  lines.push(`  .option('--root <id>', 'Start from a specific node instead of root')`);
  lines.push(`  .option('--json', 'Output as JSON')`);
  lines.push(`  .action(async (opts) => {`);
  lines.push(`    const result = await globalThis.kernel.handleRequest({ method: 'getDescendants', ...opts });`);
  lines.push(`    console.log(opts.json ? JSON.stringify(result) : result);`);
  lines.push(`  });`);
  return lines.join('\n');
}

/**
 * Add @hierarchical flags to a subcommand based on action classification.
 * - create/add actions get --parent flag
 * - list actions get --parent and --depth flags
 * - get/update/delete actions get --path flag as alternative ID
 */
function addHierarchicalFlags(lines: string[], actionName: string): void {
  const name = actionName.toLowerCase();
  if (name.startsWith('create') || name.startsWith('add') || name.startsWith('new')) {
    lines.push(`  .option('--parent <parentId>', 'Create under a specific parent node')`);
  }
  if (name.startsWith('list') || name.startsWith('all') || name.startsWith('search')) {
    lines.push(`  .option('--parent <parentId>', 'List children of a specific node')`);
    lines.push(`  .option('--depth <depth>', 'Maximum depth to recurse (default: 1)', parseInt)`);
  }
  if (name.startsWith('get') || name.startsWith('find') || name.startsWith('read') ||
      name.startsWith('update') || name.startsWith('edit') || name.startsWith('delete') || name.startsWith('remove')) {
    lines.push(`  .option('--path <path>', 'Dot-separated ancestor path as alternative to ID')`);
  }
}

// --- Command Builder ---

function buildSubcommand(
  action: ActionSchema,
  conceptCamel: string,
  overrides: Record<string, unknown>,
  cliConfig?: CliConceptConfig,
  hierConfig?: HierarchicalConfig,
): string {
  const lines: string[] = [];
  const actionOverride = overrides[action.name] as Record<string, unknown> | undefined;
  const cliMapping = cliConfig?.actions?.[action.name];

  // Command name: CLI mapping > kebab-case action name
  const commandName = cliMapping?.command || toKebabCase(action.name);

  // Description: CLI mapping > override > action description > variant prose > fallback
  const description = cliMapping?.description
    || (actionOverride?.description as string)
    || action.description
    || (action.variants[0]?.prose)
    || `Execute ${action.name}`;

  lines.push(`${conceptCamel}Command`);
  lines.push(`  .command('${commandName}')`);
  lines.push(`  .description('${description}')`);

  // Emit options for each parameter
  for (const param of action.params) {
    const flag = `--${toKebabCase(param.name)} ${optionValueTag(param)}`;
    const label = paramLabel(param.name);

    // Check positional: CLI mapping > overrides
    const cliArg = cliMapping?.args?.[param.name];
    const cliFlag = cliMapping?.flags?.[param.name];
    const paramOverride = actionOverride?.params as Record<string, Record<string, unknown>> | undefined;
    const isPositional = cliArg?.positional === true || paramOverride?.[param.name]?.positional === true;

    if (isPositional) {
      lines.push(`  .argument('<${param.name}>', '${label}')`);
    } else if (cliFlag || cliArg) {
      // Build flag with choices if available
      const choices = cliFlag?.choices || cliArg?.choices;
      const short = cliFlag?.short || cliArg?.short;
      const shortFlag = short ? `-${short}, ` : '';
      const flagDesc = cliFlag?.description || label;
      const defaultVal = cliFlag?.default || cliArg?.default;

      if (choices && choices.length > 0) {
        lines.push(`  .option('${shortFlag}--${toKebabCase(param.name)} <value>', '${flagDesc} (${choices.join('|')})'${defaultVal ? `, '${defaultVal}'` : ''})`);
      } else {
        const required = cliFlag?.required !== false;
        const method = required ? 'requiredOption' : 'option';
        lines.push(`  .${method}('${shortFlag}${flag}', '${flagDesc}'${defaultVal ? `, '${defaultVal}'` : ''})`);
      }
    } else {
      lines.push(`  .requiredOption('${flag}', '${label}')`);
    }
  }

  // @hierarchical flags
  if (hierConfig) {
    addHierarchicalFlags(lines, action.name);
  }

  // Always add --json output flag
  lines.push(`  .option('--json', 'Output as JSON')`);

  // Examples as help text
  const examples = cliMapping?.examples;
  if (examples && examples.length > 0) {
    lines.push(`  .addHelpText('after', '\\nExamples:')`);
    for (const ex of examples) {
      lines.push(`  .addHelpText('after', '  ${ex.command}  # ${ex.description}')`);
    }
  }

  // See-also references
  const seeAlso = cliMapping?.['see-also'];
  if (seeAlso && seeAlso.length > 0) {
    lines.push(`  .addHelpText('after', '\\nSee also: ${seeAlso.join(', ')}')`);
  }

  // Action handler
  lines.push(`  .action(async (opts) => {`);
  lines.push(`    const result = await globalThis.kernel.handleRequest({ method: '${action.name}', ...opts });`);
  lines.push(`    console.log(opts.json ? JSON.stringify(result) : result);`);
  lines.push(`  });`);

  return lines.join('\n');
}

// --- Generate Command File ---

function generateCommandFile(
  manifest: ConceptManifest,
  conceptName: string,
  overrides: Record<string, unknown>,
  cliConfig?: CliConceptConfig,
  hierConfig?: HierarchicalConfig,
): string {
  const conceptCamel = toCamelCase(conceptName);
  const kebab = toKebabCase(conceptName);
  const lines: string[] = [];

  // Command group name from CLI config or kebab-case concept name
  const groupName = cliConfig?.['command-group'] || kebab;
  const groupDesc = cliConfig?.description || manifest.purpose || `Manage ${conceptName} resources.`;

  lines.push(generateFileHeader('cli', conceptName));
  lines.push(`import { Command } from 'commander';`);
  lines.push('');
  lines.push(`export const ${conceptCamel}Command = new Command('${groupName}')`);
  lines.push(`  .description('${groupDesc}');`);
  lines.push('');

  // Command-level examples
  const examples = cliConfig?.examples;
  if (examples && examples.length > 0) {
    lines.push(`${conceptCamel}Command.addHelpText('after', '\\nExamples:');`);
    for (const ex of examples) {
      lines.push(`${conceptCamel}Command.addHelpText('after', '  ${ex.command}  # ${ex.description}');`);
    }
    lines.push('');
  }

  for (const action of manifest.actions) {
    lines.push(buildSubcommand(action, conceptCamel, overrides, cliConfig, hierConfig));
    lines.push('');
  }

  // @hierarchical: auto-generated tree subcommand
  if (hierConfig) {
    lines.push(buildTreeSubcommand(conceptCamel));
    lines.push('');
  }

  // Export command tree metadata for surface composition
  const actionNames = manifest.actions.map(a => {
    const cliName = cliConfig?.actions?.[a.name]?.command || toKebabCase(a.name);
    return `{ action: '${a.name}', command: '${cliName}' }`;
  });
  lines.push(`export const ${conceptCamel}CommandTree = {`);
  lines.push(`  group: '${groupName}',`);
  lines.push(`  description: '${groupDesc}',`);
  lines.push(`  commands: [${actionNames.join(', ')}],`);
  lines.push(`};`);
  lines.push('');

  return lines.join('\n');
}

// --- CLI Help Markdown Generator ---

/**
 * Generate a cli-help.md file with rendered enrichment content
 * (design principles, references, anti-patterns, companion docs, etc.)
 * using the Renderer's cli-help format.
 *
 * CLI uses <SOURCE> as its variable vocabulary for intro-template.
 */
function generateCliHelpMd(
  manifest: ConceptManifest,
  conceptName: string,
  manifestYaml?: Record<string, unknown>,
): string | null {
  const enrichment = getManifestEnrichment(manifestYaml, conceptName);
  if (!enrichment || Object.keys(enrichment).length === 0) return null;

  const lines: string[] = [];
  const kebab = toKebabCase(conceptName);

  lines.push(`# copf ${kebab} — Help`);
  lines.push('');

  // Intro line with CLI variable vocabulary
  const introTemplate = enrichment['intro-template'] as string | undefined;
  if (introTemplate) {
    const vars: Record<string, string> = { ARGUMENTS: '<source>', CONCEPT: conceptName };
    lines.push(interpolateVars(introTemplate, vars));
    lines.push('');
    delete enrichment['intro-template'];
  } else {
    lines.push(manifest.purpose || `Manage ${conceptName} resources.`);
    lines.push('');
  }

  // Render all enrichment keys via the Renderer in cli-help format
  const { output } = renderContent(enrichment, 'cli-help');
  if (output) lines.push(output);

  return lines.join('\n');
}

// --- Concept Handler ---

export const cliTargetHandler: ConceptHandler = {

  /**
   * Generate Commander.js command files for one or more concepts.
   *
   * Input projection contains the concept manifest (as nested JSON),
   * concept name, per-action overrides for positional args and
   * flag customisation, and optionally manifestYaml for CLI-specific
   * config (command tree, examples, see-also, flag choices).
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
    let overrides: Record<string, unknown> = {};
    if (overridesRaw && typeof overridesRaw === 'string') {
      try {
        overrides = JSON.parse(overridesRaw) as Record<string, unknown>;
      } catch {
        // Ignore malformed overrides
      }
    }

    // Parse manifestYaml for CLI-specific config
    let parsedManifestYaml: Record<string, unknown> | undefined;
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        parsedManifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* ignore */ }
    }

    const name = conceptName || manifest.name;
    const kebab = toKebabCase(name);
    const cliConfig = getCliConfig(parsedManifestYaml, name);
    const hierConfig = getHierarchicalTrait(parsedManifestYaml, name);
    const content = generateCommandFile(manifest, name, overrides, cliConfig, hierConfig);

    const files: Array<{ path: string; content: string }> = [
      {
        path: `${kebab}/${kebab}.command.ts`,
        content,
      },
    ];

    // Emit enrichment-driven CLI help documentation if available
    const helpMd = generateCliHelpMd(manifest, name, parsedManifestYaml);
    if (helpMd) {
      files.push({
        path: `${kebab}/${kebab}.help.md`,
        content: helpMd,
      });
    }

    return { variant: 'ok', files };
  },
};
