// ============================================================
// CLI Generation Regression Tests
//
// Compares the generated CLI (from devtools.interface.yaml via
// CliTarget) against the handmade CLI (tools/copf-cli/) to
// detect regressions in command names, flags, positional args,
// and overall command coverage.
//
// See Architecture doc: Interface Kit, Section 2.4
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

const PROJECT_ROOT = resolve(__dirname, '..');
const DEVTOOLS_MANIFEST = resolve(PROJECT_ROOT, 'examples/devtools/devtools.interface.yaml');
const GENERATED_CLI_DIR = resolve(PROJECT_ROOT, 'generated/devtools/cli');
const HANDMADE_CLI_DIR = resolve(PROJECT_ROOT, 'tools/copf-cli/src');

// ---- Handmade CLI Command Registry ----
// Extracted from tools/copf-cli/src/index.ts switch statement

interface HandmadeCommand {
  name: string;
  concept: string;
  action: string;
  positionalArgs: string[];
  flags: string[];
  description: string;
}

/**
 * The handmade CLI's command structure, derived from the
 * switch statement in tools/copf-cli/src/index.ts.
 */
const HANDMADE_COMMANDS: HandmadeCommand[] = [
  {
    name: 'init',
    concept: 'ProjectScaffold',
    action: 'scaffold',
    positionalArgs: ['name'],
    flags: [],
    description: 'Initialize a new COPF project',
  },
  {
    name: 'check',
    concept: 'SpecParser',
    action: 'parse',
    positionalArgs: [],
    flags: ['pattern'],
    description: 'Parse and validate all concept specs',
  },
  {
    name: 'generate',
    concept: 'SchemaGen',
    action: 'generate',
    positionalArgs: [],
    flags: ['target', 'concept'],
    description: 'Generate schemas + code for all concepts',
  },
  {
    name: 'compile-syncs',
    concept: 'SyncCompiler',
    action: 'compile',
    positionalArgs: [],
    flags: [],
    description: 'Compile syncs and validate against manifests',
  },
  {
    name: 'compile --cache',
    concept: 'CacheCompiler',
    action: 'compile',
    positionalArgs: [],
    flags: ['cache'],
    description: 'Build pre-compiled artifacts to .copf-cache/',
  },
  {
    name: 'test',
    concept: 'TestRunner',
    action: 'run',
    positionalArgs: ['concept'],
    flags: ['integration'],
    description: 'Run conformance tests',
  },
  {
    name: 'dev',
    concept: 'DevServer',
    action: 'start',
    positionalArgs: [],
    flags: [],
    description: 'Start the development server',
  },
  {
    name: 'deploy',
    concept: 'DeploymentValidator',
    action: 'validate',
    positionalArgs: [],
    flags: ['manifest'],
    description: 'Deploy according to manifest',
  },
  {
    name: 'trace',
    concept: 'FlowTrace',
    action: 'build',
    positionalArgs: ['flow-id'],
    flags: ['failed', 'json', 'gates'],
    description: 'Render a flow trace for debugging',
  },
  {
    name: 'migrate',
    concept: 'Migration',
    action: 'check',
    positionalArgs: ['concept'],
    flags: ['check', 'all'],
    description: 'Run schema migration',
  },
  {
    name: 'kit',
    concept: 'KitManager',
    action: '*',
    positionalArgs: ['subcommand'],
    flags: [],
    description: 'Kit management',
  },
  {
    name: 'interface',
    concept: 'InterfaceGenerator',
    action: '*',
    positionalArgs: ['subcommand'],
    flags: ['manifest'],
    description: 'Interface generation',
  },
];

// ---- Generated CLI Structure Extraction ----

interface GeneratedCommand {
  group: string;
  subcommands: Array<{
    name: string;
    hasJsonFlag: boolean;
    requiredOptions: string[];
    optionalOptions: string[];
    positionalArgs: string[];
  }>;
}

/** Parse a generated .command.ts file to extract its command structure. */
function parseGeneratedCommandFile(content: string): GeneratedCommand {
  const groupMatch = content.match(/new Command\('([^']+)'\)/);
  const group = groupMatch ? groupMatch[1] : '';

  const subcommands: GeneratedCommand['subcommands'] = [];

  // Match .command('name') blocks
  const commandBlocks = content.split(/\n\w+Command\s*\n/).slice(1);
  // Simpler: find all .command('...') calls
  const commandRegex = /\.command\('([^']+)'\)/g;
  let match;
  while ((match = commandRegex.exec(content)) !== null) {
    const cmdName = match[1];
    // Extract options from the section after this .command() call
    const startIdx = match.index;
    const nextCommandIdx = content.indexOf(".command('", startIdx + 1);
    const endIdx = nextCommandIdx > 0 ? nextCommandIdx : content.length;
    const block = content.substring(startIdx, endIdx);

    const requiredOptions: string[] = [];
    const optionalOptions: string[] = [];
    const positionalArgs: string[] = [];

    // Extract .requiredOption patterns
    const reqOptRegex = /\.requiredOption\('--([a-z-]+)/g;
    let optMatch;
    while ((optMatch = reqOptRegex.exec(block)) !== null) {
      requiredOptions.push(optMatch[1]);
    }

    // Extract .option patterns (non-json)
    const optRegex = /\.option\('--([a-z-]+)/g;
    while ((optMatch = optRegex.exec(block)) !== null) {
      if (optMatch[1] !== 'json') {
        optionalOptions.push(optMatch[1]);
      }
    }

    // Extract .argument patterns
    const argRegex = /\.argument\('<([^>]+)>'/g;
    while ((optMatch = argRegex.exec(block)) !== null) {
      positionalArgs.push(optMatch[1]);
    }

    const hasJsonFlag = block.includes("--json");

    subcommands.push({
      name: cmdName,
      hasJsonFlag,
      requiredOptions,
      optionalOptions,
      positionalArgs,
    });
  }

  return { group, subcommands };
}

// ---- Manifest Parsing ----

interface ConceptOverride {
  command?: string;
  params?: Record<string, { positional?: boolean }>;
}

function parseDevtoolsOverrides(
  manifestYaml: Record<string, unknown>,
): Map<string, Record<string, ConceptOverride>> {
  const overrides = new Map<string, Record<string, ConceptOverride>>();

  // Check both 'concept-overrides' and 'concepts' keys
  const conceptOverrides =
    (manifestYaml['concept-overrides'] as Record<string, Record<string, unknown>>) ||
    {};

  for (const [conceptName, config] of Object.entries(conceptOverrides)) {
    const cli = config.cli as Record<string, unknown> | undefined;
    if (!cli?.actions) continue;
    const actions = cli.actions as Record<string, ConceptOverride>;
    overrides.set(conceptName, actions);
  }

  return overrides;
}

// ---- Tests ----

describe('CLI Generation Regression', () => {
  let manifestYaml: Record<string, unknown>;
  let generatedCommands: Map<string, GeneratedCommand>;
  let conceptOverrides: Map<string, Record<string, ConceptOverride>>;

  beforeAll(() => {
    // Parse the devtools manifest
    const source = readFileSync(DEVTOOLS_MANIFEST, 'utf-8');
    manifestYaml = parseYaml(source) as Record<string, unknown>;
    conceptOverrides = parseDevtoolsOverrides(manifestYaml);

    // Parse all generated command files
    generatedCommands = new Map();
    const indexContent = readFileSync(resolve(GENERATED_CLI_DIR, 'index.ts'), 'utf-8');

    // Extract concept directories from generated CLI
    const importRegex = /from '\.\/([^/]+)\//g;
    let match;
    while ((match = importRegex.exec(indexContent)) !== null) {
      const dirName = match[1];
      const kebabDir = dirName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const commandFilePath = resolve(GENERATED_CLI_DIR, kebabDir, `${kebabDir}.command.ts`);
      if (existsSync(commandFilePath)) {
        const content = readFileSync(commandFilePath, 'utf-8');
        const parsed = parseGeneratedCommandFile(content);
        generatedCommands.set(parsed.group, parsed);
      }
    }
  });

  // ---- Structural Coverage ----

  describe('command coverage', () => {
    it('generated CLI has a command group for each framework concept in manifest', () => {
      const manifestConcepts = (manifestYaml.concepts as string[]) || [];
      const conceptNames = manifestConcepts
        .map(c => {
          const fileName = c.split('/').pop()?.replace('.concept', '') || '';
          return fileName; // e.g. "spec-parser"
        })
        .filter(Boolean);

      for (const conceptFile of conceptNames) {
        const found = generatedCommands.has(conceptFile);
        expect(found, `Generated CLI should have command group for concept file "${conceptFile}"`).toBe(true);
      }
    });

    it('generated CLI has the expected number of command groups', () => {
      const expectedCount = ((manifestYaml.concepts as string[]) || []).length;
      expect(generatedCommands.size).toBe(expectedCount);
    });

    it('each generated command group has at least one subcommand', () => {
      for (const [group, cmd] of generatedCommands) {
        expect(
          cmd.subcommands.length,
          `Command group "${group}" should have at least one subcommand`,
        ).toBeGreaterThan(0);
      }
    });
  });

  // ---- Command Name Mapping ----

  describe('concept-overrides command name mapping', () => {
    it('devtools manifest has concept-overrides defined', () => {
      expect(manifestYaml['concept-overrides']).toBeDefined();
      expect(conceptOverrides.size).toBeGreaterThan(0);
    });

    it('SpecParser override maps parse → check', () => {
      const specParserOverrides = conceptOverrides.get('SpecParser');
      expect(specParserOverrides).toBeDefined();
      expect(specParserOverrides?.parse?.command).toBe('check');
    });

    it('ProjectScaffold override maps scaffold → init', () => {
      const scaffoldOverrides = conceptOverrides.get('ProjectScaffold');
      expect(scaffoldOverrides).toBeDefined();
      expect(scaffoldOverrides?.scaffold?.command).toBe('init');
    });

    it('REGRESSION: generated SpecParser CLI should use "check" command name from override', () => {
      const specParser = generatedCommands.get('spec-parser');
      expect(specParser).toBeDefined();

      const subcommandNames = specParser!.subcommands.map(s => s.name);

      // The concept-overrides say parse → check
      // If overrides are applied, we'd see 'check'. If not, 'parse'.
      const hasOverriddenName = subcommandNames.includes('check');
      const hasFallbackName = subcommandNames.includes('parse');

      if (!hasOverriddenName && hasFallbackName) {
        expect.fail(
          'REGRESSION: concept-overrides not applied. ' +
          'SpecParser generated "parse" instead of "check". ' +
          'The concept-overrides key in devtools.interface.yaml is not ' +
          'being read by getConceptOverrides() in interface-generator.impl.ts ' +
          '(it only checks "concepts", not "concept-overrides").'
        );
      }

      expect(hasOverriddenName).toBe(true);
    });

    it('REGRESSION: generated ProjectScaffold CLI should use "init" command name from override', () => {
      const scaffold = generatedCommands.get('project-scaffold');
      expect(scaffold).toBeDefined();

      const subcommandNames = scaffold!.subcommands.map(s => s.name);

      const hasOverriddenName = subcommandNames.includes('init');
      const hasFallbackName = subcommandNames.includes('scaffold');

      if (!hasOverriddenName && hasFallbackName) {
        expect.fail(
          'REGRESSION: concept-overrides not applied. ' +
          'ProjectScaffold generated "scaffold" instead of "init". ' +
          'The concept-overrides key is not being read during CLI generation.'
        );
      }

      expect(hasOverriddenName).toBe(true);
    });

    it('REGRESSION: KitManager init should have "name" as positional arg from override', () => {
      const kitManager = generatedCommands.get('kit-manager');
      expect(kitManager).toBeDefined();

      const initCmd = kitManager!.subcommands.find(s => s.name === 'init');
      expect(initCmd).toBeDefined();

      // The override says name should be positional
      const hasPositionalName = initCmd!.positionalArgs.includes('name');
      const hasRequiredName = initCmd!.requiredOptions.includes('name');

      if (!hasPositionalName && hasRequiredName) {
        expect.fail(
          'REGRESSION: concept-overrides positional mapping not applied. ' +
          'KitManager init has --name as required option instead of positional argument. ' +
          'The concept-overrides.KitManager.cli.actions.init.params.name.positional ' +
          'is not being read during CLI generation.'
        );
      }

      expect(hasPositionalName).toBe(true);
    });
  });

  // ---- Handmade ↔ Generated Parity ----

  describe('handmade vs generated command parity', () => {
    // Map from handmade command concepts to generated group names
    const CONCEPT_TO_GROUP: Record<string, string> = {
      ProjectScaffold: 'project-scaffold',
      SpecParser: 'spec-parser',
      SchemaGen: 'schema-gen',
      SyncCompiler: 'sync-compiler',
      CacheCompiler: 'cache-compiler',
      DevServer: 'dev-server',
      DeploymentValidator: 'deployment-validator',
      FlowTrace: 'flow-trace',
      Migration: 'migration',
      KitManager: 'kit-manager',
    };

    it('every handmade concept-backed command has a generated counterpart', () => {
      const missing: string[] = [];

      for (const handmade of HANDMADE_COMMANDS) {
        const expectedGroup = CONCEPT_TO_GROUP[handmade.concept];
        if (!expectedGroup) continue; // skip non-concept commands like 'test', 'interface'

        if (!generatedCommands.has(expectedGroup)) {
          missing.push(
            `${handmade.name} (concept: ${handmade.concept}, expected group: ${expectedGroup})`,
          );
        }
      }

      expect(
        missing,
        `These handmade commands have no generated counterpart: ${missing.join(', ')}`,
      ).toEqual([]);
    });

    it('generated CLI groups have the same action count as handmade equivalents', () => {
      // KitManager: handmade has subcommands init, validate, test, list, check-overrides
      const kitManager = generatedCommands.get('kit-manager');
      expect(kitManager).toBeDefined();
      expect(kitManager!.subcommands.length).toBe(5);

      // DevServer: handmade has dev (implicitly: start), generated has start/stop/status
      const devServer = generatedCommands.get('dev-server');
      expect(devServer).toBeDefined();
      expect(devServer!.subcommands.length).toBe(3);

      // FlowTrace: handmade has trace, generated has build/render
      const flowTrace = generatedCommands.get('flow-trace');
      expect(flowTrace).toBeDefined();
      expect(flowTrace!.subcommands.length).toBe(2);
    });
  });

  // ---- JSON Output Flag ----

  describe('--json flag coverage', () => {
    it('every generated subcommand has --json flag', () => {
      const missingJson: string[] = [];

      for (const [group, cmd] of generatedCommands) {
        for (const sub of cmd.subcommands) {
          if (!sub.hasJsonFlag) {
            missingJson.push(`${group} ${sub.name}`);
          }
        }
      }

      expect(
        missingJson,
        `These generated subcommands lack --json flag: ${missingJson.join(', ')}`,
      ).toEqual([]);
    });

    it('handmade trace command has --json flag matching generated', () => {
      const traceHandmade = HANDMADE_COMMANDS.find(c => c.name === 'trace');
      expect(traceHandmade).toBeDefined();
      expect(traceHandmade!.flags).toContain('json');
    });
  });

  // ---- Generated File Integrity ----

  describe('generated file integrity', () => {
    it('generated CLI has an index.ts entrypoint', () => {
      expect(existsSync(resolve(GENERATED_CLI_DIR, 'index.ts'))).toBe(true);
    });

    it('index.ts imports all generated command files', () => {
      const indexContent = readFileSync(resolve(GENERATED_CLI_DIR, 'index.ts'), 'utf-8');

      for (const [group, _] of generatedCommands) {
        // The index uses PascalCase imports
        const pascal = group
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join('');
        expect(
          indexContent.includes(`${pascal}Command`),
          `index.ts should import ${pascal}Command for group "${group}"`,
        ).toBe(true);
      }
    });

    it('each generated file has auto-generated header comment', () => {
      for (const [group, _] of generatedCommands) {
        const filePath = resolve(GENERATED_CLI_DIR, group, `${group}.command.ts`);
        if (!existsSync(filePath)) continue;
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain('Auto-generated by COPF Interface Kit');
        expect(content).toContain('Do not edit manually');
      }
    });

    it('each generated file exports a commandTree metadata object', () => {
      for (const [group, _] of generatedCommands) {
        const filePath = resolve(GENERATED_CLI_DIR, group, `${group}.command.ts`);
        if (!existsSync(filePath)) continue;
        const content = readFileSync(filePath, 'utf-8');
        expect(
          content.includes('CommandTree'),
          `${group}.command.ts should export a commandTree`,
        ).toBe(true);
      }
    });
  });

  // ---- Devtools Manifest Consistency ----

  describe('devtools manifest consistency', () => {
    it('manifest concepts are all parseable .concept file paths', () => {
      const concepts = manifestYaml.concepts as string[];
      expect(concepts).toBeDefined();
      expect(concepts.length).toBeGreaterThan(0);

      for (const path of concepts) {
        expect(path).toMatch(/\.concept$/);
        const resolved = resolve(PROJECT_ROOT, path);
        expect(
          existsSync(resolved),
          `Manifest references ${path} but file does not exist`,
        ).toBe(true);
      }
    });

    it('manifest declares cli as a target', () => {
      const targets = manifestYaml.targets as Record<string, unknown>;
      expect(targets).toBeDefined();
      expect(targets.cli).toBeDefined();
    });

    it('concept-overrides only reference concepts listed in manifest', () => {
      const overrideKeys = Object.keys(
        (manifestYaml['concept-overrides'] as Record<string, unknown>) || {},
      );
      const manifestConcepts = ((manifestYaml.concepts as string[]) || []).map(c => {
        // Extract concept name from file path: spec-parser.concept → SpecParser
        const fileName = c.split('/').pop()?.replace('.concept', '') || '';
        return fileName
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join('');
      });

      for (const override of overrideKeys) {
        expect(
          manifestConcepts,
          `concept-overrides key "${override}" should reference a concept in the manifest`,
        ).toContain(override);
      }
    });
  });
});
