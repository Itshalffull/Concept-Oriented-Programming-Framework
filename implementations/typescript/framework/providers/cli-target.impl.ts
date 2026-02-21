// ============================================================
// CLI Target Provider Handler
//
// Generates Commander.js command definitions from concept
// projections. Each concept produces a single .command.ts file
// with subcommands for every action in the concept manifest.
// Architecture doc: Interface Kit
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptManifest, ActionSchema, ActionParamSchema } from '../../../../kernel/src/types.js';
import { toKebabCase, toCamelCase, generateFileHeader } from './codegen-utils.js';

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

// --- Command Builder ---

function buildSubcommand(
  action: ActionSchema,
  conceptCamel: string,
  overrides: Record<string, unknown>,
): string {
  const lines: string[] = [];
  const actionOverride = overrides[action.name] as Record<string, unknown> | undefined;

  // Determine description: override > action description > variant prose > fallback
  const description = (actionOverride?.description as string)
    || action.description
    || (action.variants[0]?.prose)
    || `Execute ${action.name}`;

  lines.push(`${conceptCamel}Command`);
  lines.push(`  .command('${toKebabCase(action.name)}')`);
  lines.push(`  .description('${description}')`);

  // Emit options for each parameter
  for (const param of action.params) {
    const flag = `--${toKebabCase(param.name)} ${optionValueTag(param)}`;
    const label = paramLabel(param.name);

    // Check if this parameter should be positional (from overrides)
    const paramOverride = actionOverride?.params as Record<string, Record<string, unknown>> | undefined;
    const isPositional = paramOverride?.[param.name]?.positional === true;

    if (isPositional) {
      // Positional arguments are added via .argument()
      lines.push(`  .argument('<${param.name}>', '${label}')`);
    } else {
      lines.push(`  .requiredOption('${flag}', '${label}')`);
    }
  }

  // Always add --json output flag
  lines.push(`  .option('--json', 'Output as JSON')`);

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
): string {
  const conceptCamel = toCamelCase(conceptName);
  const kebab = toKebabCase(conceptName);
  const lines: string[] = [];

  lines.push(generateFileHeader('cli', conceptName));
  lines.push(`import { Command } from 'commander';`);
  lines.push('');
  lines.push(`export const ${conceptCamel}Command = new Command('${kebab}')`);
  lines.push(`  .description('${manifest.purpose || `Manage ${conceptName} resources.`}');`);
  lines.push('');

  for (const action of manifest.actions) {
    lines.push(buildSubcommand(action, conceptCamel, overrides));
    lines.push('');
  }

  return lines.join('\n');
}

// --- Concept Handler ---

export const cliTargetHandler: ConceptHandler = {

  /**
   * Generate Commander.js command files for one or more concepts.
   *
   * Input projection contains the concept manifest (as nested JSON),
   * concept name, and per-action overrides for positional args and
   * flag customisation.
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

    const name = conceptName || manifest.name;
    const kebab = toKebabCase(name);
    const content = generateCommandFile(manifest, name, overrides);

    const files = [
      {
        path: `${kebab}/${kebab}.command.ts`,
        content,
      },
    ];

    return { variant: 'ok', files };
  },
};
