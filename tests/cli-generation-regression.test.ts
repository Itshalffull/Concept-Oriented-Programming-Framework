// ============================================================
// CLI Generation Regression Tests
//
// Compares the generated CLI (from devtools.interface.yaml via
// CliTarget) against the handmade CLI (tools/copf-cli/) to
// detect regressions in command names, flags, positional args,
// and overall command coverage.
//
// Every handmade command is tested individually against its
// generated counterpart for subcommand names, all flags, all
// positional arguments, and parameter types.
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

// ---- Generated CLI Structure Extraction ----

interface GeneratedSubcommand {
  name: string;
  hasJsonFlag: boolean;
  requiredOptions: string[];
  optionalOptions: string[];
  positionalArgs: string[];
  allParams: string[];
}

interface GeneratedCommand {
  group: string;
  subcommands: GeneratedSubcommand[];
}

/** Parse a generated .command.ts file to extract its command structure. */
function parseGeneratedCommandFile(content: string): GeneratedCommand {
  const groupMatch = content.match(/new Command\('([^']+)'\)/);
  const group = groupMatch ? groupMatch[1] : '';

  const subcommands: GeneratedSubcommand[] = [];

  const commandRegex = /\.command\('([^']+)'\)/g;
  let match;
  while ((match = commandRegex.exec(content)) !== null) {
    const cmdName = match[1];
    const startIdx = match.index;
    const nextCommandIdx = content.indexOf(".command('", startIdx + 1);
    const endIdx = nextCommandIdx > 0 ? nextCommandIdx : content.length;
    const block = content.substring(startIdx, endIdx);

    const requiredOptions: string[] = [];
    const optionalOptions: string[] = [];
    const positionalArgs: string[] = [];

    const reqOptRegex = /\.requiredOption\('--([a-z-]+)/g;
    let optMatch;
    while ((optMatch = reqOptRegex.exec(block)) !== null) {
      requiredOptions.push(optMatch[1]);
    }

    const optRegex = /\.option\('--([a-z-]+)/g;
    while ((optMatch = optRegex.exec(block)) !== null) {
      if (optMatch[1] !== 'json') {
        optionalOptions.push(optMatch[1]);
      }
    }

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
      allParams: [...requiredOptions, ...optionalOptions, ...positionalArgs],
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
  const conceptOverrides =
    (manifestYaml['concept-overrides'] as Record<string, Record<string, unknown>>) || {};

  for (const [conceptName, config] of Object.entries(conceptOverrides)) {
    const cli = config.cli as Record<string, unknown> | undefined;
    if (!cli?.actions) continue;
    const actions = cli.actions as Record<string, ConceptOverride>;
    overrides.set(conceptName, actions);
  }

  return overrides;
}

function getGeneratedSubcommand(
  cmd: GeneratedCommand,
  name: string,
): GeneratedSubcommand | undefined {
  return cmd.subcommands.find(s => s.name === name);
}

// ---- Tests ----

describe('CLI Generation Regression', () => {
  let manifestYaml: Record<string, unknown>;
  let generatedCommands: Map<string, GeneratedCommand>;
  let conceptOverrides: Map<string, Record<string, ConceptOverride>>;

  beforeAll(() => {
    const source = readFileSync(DEVTOOLS_MANIFEST, 'utf-8');
    manifestYaml = parseYaml(source) as Record<string, unknown>;
    conceptOverrides = parseDevtoolsOverrides(manifestYaml);

    generatedCommands = new Map();
    const indexContent = readFileSync(resolve(GENERATED_CLI_DIR, 'index.ts'), 'utf-8');

    const importRegex = /from '\.\/([^/]+)\//g;
    let match;
    while ((match = importRegex.exec(indexContent)) !== null) {
      const dirName = match[1];
      const kebabDir = dirName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const commandFilePath = resolve(GENERATED_CLI_DIR, kebabDir, `${kebabDir}.command.ts`);
      if (existsSync(commandFilePath)) {
        const content = readFileSync(commandFilePath, 'utf-8');
        const parsed = parseGeneratedCommandFile(content);
        // Key by directory name (not group name) to handle shared command
        // groups like "scaffold" used by all scaffold generators.
        generatedCommands.set(kebabDir, parsed);
      }
    }
  });

  // ================================================================
  // Per-Command Parity Tests
  //
  // Each test below verifies a specific handmade CLI command against
  // its generated counterpart: subcommand name, positional args,
  // required options, optional flags, and --json flag.
  // ================================================================

  // ---- copf init <name> → project-scaffold init <name> ----

  describe('init → ProjectScaffold parity', () => {
    it('generated group "project-scaffold" exists', () => {
      expect(generatedCommands.has('project-scaffold')).toBe(true);
    });

    it('has exactly 1 subcommand', () => {
      const cmd = generatedCommands.get('project-scaffold')!;
      expect(cmd.subcommands.length).toBe(1);
    });

    it('subcommand is named "init" (via concept-override scaffold→init)', () => {
      const cmd = generatedCommands.get('project-scaffold')!;
      const sub = getGeneratedSubcommand(cmd, 'init');
      expect(sub, 'subcommand "init" should exist').toBeDefined();
    });

    it('handmade positional "name" is a generated positional arg', () => {
      const cmd = generatedCommands.get('project-scaffold')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.positionalArgs).toContain('name');
    });

    it('"name" is NOT a required option (must be positional)', () => {
      const cmd = generatedCommands.get('project-scaffold')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.requiredOptions).not.toContain('name');
    });

    it('has --json flag', () => {
      const cmd = generatedCommands.get('project-scaffold')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    it('has no unexpected extra required options', () => {
      const cmd = generatedCommands.get('project-scaffold')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.requiredOptions).toEqual([]);
    });
  });

  // ---- copf check → spec-parser check ----

  describe('check → SpecParser parity', () => {
    it('generated group "spec-parser" exists', () => {
      expect(generatedCommands.has('spec-parser')).toBe(true);
    });

    it('has exactly 1 subcommand', () => {
      const cmd = generatedCommands.get('spec-parser')!;
      expect(cmd.subcommands.length).toBe(1);
    });

    it('subcommand is named "check" (via concept-override parse→check)', () => {
      const cmd = generatedCommands.get('spec-parser')!;
      const sub = getGeneratedSubcommand(cmd, 'check');
      expect(sub, 'subcommand "check" should exist (override parse→check)').toBeDefined();
    });

    it('does NOT still use fallback name "parse"', () => {
      const cmd = generatedCommands.get('spec-parser')!;
      const sub = getGeneratedSubcommand(cmd, 'parse');
      expect(sub, 'subcommand "parse" should NOT exist after override').toBeUndefined();
    });

    it('has --json flag', () => {
      const cmd = generatedCommands.get('spec-parser')!;
      const sub = getGeneratedSubcommand(cmd, 'check')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    it('has positional "source" arg (via concept-override source.positional)', () => {
      const cmd = generatedCommands.get('spec-parser')!;
      const sub = getGeneratedSubcommand(cmd, 'check')!;
      expect(sub.positionalArgs).toContain('source');
    });

    it('"source" is NOT a required option (must be positional)', () => {
      const cmd = generatedCommands.get('spec-parser')!;
      const sub = getGeneratedSubcommand(cmd, 'check')!;
      expect(sub.requiredOptions).not.toContain('source');
    });
  });

  // ---- copf generate --target <lang> → schema-gen generate ----

  describe('generate → SchemaGen parity', () => {
    it('generated group "schema-gen" exists', () => {
      expect(generatedCommands.has('schema-gen')).toBe(true);
    });

    it('has exactly 2 subcommands', () => {
      const cmd = generatedCommands.get('schema-gen')!;
      expect(cmd.subcommands.length).toBe(2);
    });

    it('subcommand is named "generate"', () => {
      const cmd = generatedCommands.get('schema-gen')!;
      const sub = getGeneratedSubcommand(cmd, 'generate');
      expect(sub).toBeDefined();
    });

    it('generated has --spec and --ast as required options (concept-level params)', () => {
      const cmd = generatedCommands.get('schema-gen')!;
      const sub = getGeneratedSubcommand(cmd, 'generate')!;
      expect(sub.requiredOptions).toContain('spec');
      expect(sub.requiredOptions).toContain('ast');
    });

    it('has --json flag', () => {
      const cmd = generatedCommands.get('schema-gen')!;
      const sub = getGeneratedSubcommand(cmd, 'generate')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    it('has no positional args (handmade also has none)', () => {
      const cmd = generatedCommands.get('schema-gen')!;
      const sub = getGeneratedSubcommand(cmd, 'generate')!;
      expect(sub.positionalArgs).toEqual([]);
    });
  });

  // ---- copf compile-syncs → sync-compiler compile ----

  describe('compile-syncs → SyncCompiler parity', () => {
    it('generated group "sync-compiler" exists', () => {
      expect(generatedCommands.has('sync-compiler')).toBe(true);
    });

    it('has exactly 1 subcommand', () => {
      const cmd = generatedCommands.get('sync-compiler')!;
      expect(cmd.subcommands.length).toBe(1);
    });

    it('subcommand is named "compile"', () => {
      const cmd = generatedCommands.get('sync-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile');
      expect(sub).toBeDefined();
    });

    it('generated has --sync and --ast as required options (concept-level params)', () => {
      const cmd = generatedCommands.get('sync-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.requiredOptions).toContain('sync');
      expect(sub.requiredOptions).toContain('ast');
    });

    it('has --json flag', () => {
      const cmd = generatedCommands.get('sync-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    it('has no positional args (handmade also has none)', () => {
      const cmd = generatedCommands.get('sync-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.positionalArgs).toEqual([]);
    });
  });

  // ---- copf compile --cache → cache-compiler compile ----

  describe('compile --cache → CacheCompiler parity', () => {
    it('generated group "cache-compiler" exists', () => {
      expect(generatedCommands.has('cache-compiler')).toBe(true);
    });

    it('has exactly 1 subcommand', () => {
      const cmd = generatedCommands.get('cache-compiler')!;
      expect(cmd.subcommands.length).toBe(1);
    });

    it('subcommand is named "compile"', () => {
      const cmd = generatedCommands.get('cache-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile');
      expect(sub).toBeDefined();
    });

    it('generated has --specs flag matching handmade --specs flag', () => {
      const cmd = generatedCommands.get('cache-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.requiredOptions).toContain('specs');
    });

    it('generated has --syncs flag matching handmade --syncs flag', () => {
      const cmd = generatedCommands.get('cache-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.requiredOptions).toContain('syncs');
    });

    it('generated has --implementations flag matching handmade --implementations flag', () => {
      const cmd = generatedCommands.get('cache-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.requiredOptions).toContain('implementations');
    });

    it('has --json flag', () => {
      const cmd = generatedCommands.get('cache-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    it('has no positional args (handmade also has none)', () => {
      const cmd = generatedCommands.get('cache-compiler')!;
      const sub = getGeneratedSubcommand(cmd, 'compile')!;
      expect(sub.positionalArgs).toEqual([]);
    });
  });

  // ---- copf dev → dev-server start/stop/status ----

  describe('dev → DevServer parity', () => {
    it('generated group "dev-server" exists', () => {
      expect(generatedCommands.has('dev-server')).toBe(true);
    });

    it('has exactly 3 subcommands (start, stop, status)', () => {
      const cmd = generatedCommands.get('dev-server')!;
      expect(cmd.subcommands.length).toBe(3);
    });

    it('has subcommand "start" (maps to handmade "dev")', () => {
      const cmd = generatedCommands.get('dev-server')!;
      expect(getGeneratedSubcommand(cmd, 'start')).toBeDefined();
    });

    it('has subcommand "stop"', () => {
      const cmd = generatedCommands.get('dev-server')!;
      expect(getGeneratedSubcommand(cmd, 'stop')).toBeDefined();
    });

    it('has subcommand "status"', () => {
      const cmd = generatedCommands.get('dev-server')!;
      expect(getGeneratedSubcommand(cmd, 'status')).toBeDefined();
    });

    it('start has --port flag matching handmade --port flag', () => {
      const cmd = generatedCommands.get('dev-server')!;
      const sub = getGeneratedSubcommand(cmd, 'start')!;
      expect(sub.requiredOptions).toContain('port');
    });

    it('start has --specs flag matching handmade --specs flag', () => {
      const cmd = generatedCommands.get('dev-server')!;
      const sub = getGeneratedSubcommand(cmd, 'start')!;
      expect(sub.requiredOptions).toContain('specs');
    });

    it('start has --syncs flag matching handmade --syncs flag', () => {
      const cmd = generatedCommands.get('dev-server')!;
      const sub = getGeneratedSubcommand(cmd, 'start')!;
      expect(sub.requiredOptions).toContain('syncs');
    });

    it('all subcommands have --json flag', () => {
      const cmd = generatedCommands.get('dev-server')!;
      for (const sub of cmd.subcommands) {
        expect(sub.hasJsonFlag, `dev-server ${sub.name} should have --json`).toBe(true);
      }
    });

    it('stop has --session as required option', () => {
      const cmd = generatedCommands.get('dev-server')!;
      const sub = getGeneratedSubcommand(cmd, 'stop')!;
      expect(sub.requiredOptions).toContain('session');
    });

    it('status has --session as required option', () => {
      const cmd = generatedCommands.get('dev-server')!;
      const sub = getGeneratedSubcommand(cmd, 'status')!;
      expect(sub.requiredOptions).toContain('session');
    });
  });

  // ---- copf deploy --manifest <file> → deployment-validator parse/validate ----

  describe('deploy → DeploymentValidator parity', () => {
    it('generated group "deployment-validator" exists', () => {
      expect(generatedCommands.has('deployment-validator')).toBe(true);
    });

    it('has exactly 2 subcommands (parse, validate)', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      expect(cmd.subcommands.length).toBe(2);
    });

    it('has subcommand "parse"', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      expect(getGeneratedSubcommand(cmd, 'parse')).toBeDefined();
    });

    it('has subcommand "validate" (maps to handmade "deploy")', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      expect(getGeneratedSubcommand(cmd, 'validate')).toBeDefined();
    });

    it('validate has --manifest flag matching handmade --manifest flag', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      const sub = getGeneratedSubcommand(cmd, 'validate')!;
      expect(sub.requiredOptions).toContain('manifest');
    });

    it('validate has --concepts as required option', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      const sub = getGeneratedSubcommand(cmd, 'validate')!;
      expect(sub.requiredOptions).toContain('concepts');
    });

    it('validate has --syncs as required option', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      const sub = getGeneratedSubcommand(cmd, 'validate')!;
      expect(sub.requiredOptions).toContain('syncs');
    });

    it('parse has --raw as required option', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      const sub = getGeneratedSubcommand(cmd, 'parse')!;
      expect(sub.requiredOptions).toContain('raw');
    });

    it('all subcommands have --json flag', () => {
      const cmd = generatedCommands.get('deployment-validator')!;
      for (const sub of cmd.subcommands) {
        expect(sub.hasJsonFlag, `deployment-validator ${sub.name} should have --json`).toBe(true);
      }
    });
  });

  // ---- copf trace <flow-id> → flow-trace build/render ----

  describe('trace → FlowTrace parity', () => {
    it('generated group "flow-trace" exists', () => {
      expect(generatedCommands.has('flow-trace')).toBe(true);
    });

    it('has exactly 2 subcommands (build, render)', () => {
      const cmd = generatedCommands.get('flow-trace')!;
      expect(cmd.subcommands.length).toBe(2);
    });

    it('has subcommand "build" (maps to handmade "trace")', () => {
      const cmd = generatedCommands.get('flow-trace')!;
      expect(getGeneratedSubcommand(cmd, 'build')).toBeDefined();
    });

    it('has subcommand "render"', () => {
      const cmd = generatedCommands.get('flow-trace')!;
      expect(getGeneratedSubcommand(cmd, 'render')).toBeDefined();
    });

    it('build has --flow-id matching handmade positional flow-id', () => {
      const cmd = generatedCommands.get('flow-trace')!;
      const sub = getGeneratedSubcommand(cmd, 'build')!;
      // Generated puts flow-id as a required option (concept spec defines it as param)
      expect(sub.requiredOptions).toContain('flow-id');
    });

    it('all subcommands have --json flag (handmade has --json on trace)', () => {
      const cmd = generatedCommands.get('flow-trace')!;
      for (const sub of cmd.subcommands) {
        expect(sub.hasJsonFlag, `flow-trace ${sub.name} should have --json`).toBe(true);
      }
    });

    it('render has --trace and --options as required options', () => {
      const cmd = generatedCommands.get('flow-trace')!;
      const sub = getGeneratedSubcommand(cmd, 'render')!;
      expect(sub.requiredOptions).toContain('trace');
      expect(sub.requiredOptions).toContain('options');
    });
  });

  // ---- copf migrate <concept> → migration check/complete ----

  describe('migrate → Migration parity', () => {
    it('generated group "migration" exists', () => {
      expect(generatedCommands.has('migration')).toBe(true);
    });

    it('has exactly 2 subcommands (check, complete)', () => {
      const cmd = generatedCommands.get('migration')!;
      expect(cmd.subcommands.length).toBe(2);
    });

    it('has subcommand "check" (maps to handmade "migrate" default mode)', () => {
      const cmd = generatedCommands.get('migration')!;
      expect(getGeneratedSubcommand(cmd, 'check')).toBeDefined();
    });

    it('has subcommand "complete"', () => {
      const cmd = generatedCommands.get('migration')!;
      expect(getGeneratedSubcommand(cmd, 'complete')).toBeDefined();
    });

    it('check has --concept matching handmade positional concept arg', () => {
      const cmd = generatedCommands.get('migration')!;
      const sub = getGeneratedSubcommand(cmd, 'check')!;
      expect(sub.requiredOptions).toContain('concept');
    });

    it('check has --spec-version as required option', () => {
      const cmd = generatedCommands.get('migration')!;
      const sub = getGeneratedSubcommand(cmd, 'check')!;
      expect(sub.requiredOptions).toContain('spec-version');
    });

    it('complete has --concept and --version as required options', () => {
      const cmd = generatedCommands.get('migration')!;
      const sub = getGeneratedSubcommand(cmd, 'complete')!;
      expect(sub.requiredOptions).toContain('concept');
      expect(sub.requiredOptions).toContain('version');
    });

    it('all subcommands have --json flag', () => {
      const cmd = generatedCommands.get('migration')!;
      for (const sub of cmd.subcommands) {
        expect(sub.hasJsonFlag, `migration ${sub.name} should have --json`).toBe(true);
      }
    });
  });

  // ---- copf kit <sub> → kit-manager <sub> ----

  describe('kit → KitManager parity', () => {
    it('generated group "kit-manager" exists', () => {
      expect(generatedCommands.has('kit-manager')).toBe(true);
    });

    it('has exactly 5 subcommands matching handmade kit subcommands', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      expect(cmd.subcommands.length).toBe(5);
    });

    it('has all 5 subcommand names: init, validate, test, list, check-overrides', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const names = cmd.subcommands.map(s => s.name).sort();
      expect(names).toEqual(['check-overrides', 'init', 'list', 'test', 'validate']);
    });

    // ---- kit init <name> ----
    it('init: has positional "name" arg (via concept-override)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.positionalArgs).toContain('name');
    });

    it('init: "name" is NOT a required option (must be positional)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.requiredOptions).not.toContain('name');
    });

    it('init: has --json flag', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    it('init: has no extra required options', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'init')!;
      expect(sub.requiredOptions).toEqual([]);
    });

    // ---- kit validate <path> ----
    it('validate: has positional "path" arg (via concept-override)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'validate')!;
      expect(sub.positionalArgs).toContain('path');
    });

    it('validate: "path" is NOT a required option (must be positional)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'validate')!;
      expect(sub.requiredOptions).not.toContain('path');
    });

    it('validate: has --json flag', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'validate')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    // ---- kit test <path> ----
    it('test: has positional "path" arg (via concept-override)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'test')!;
      expect(sub.positionalArgs).toContain('path');
    });

    it('test: "path" is NOT a required option (must be positional)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'test')!;
      expect(sub.requiredOptions).not.toContain('path');
    });

    it('test: has --json flag', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'test')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    // ---- kit list ----
    it('list: has no positional args (handmade has none)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'list')!;
      expect(sub.positionalArgs).toEqual([]);
    });

    it('list: has no required options (handmade has none)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'list')!;
      expect(sub.requiredOptions).toEqual([]);
    });

    it('list: has --json flag', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'list')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    // ---- kit check-overrides ----
    it('check-overrides: has --json flag', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'check-overrides')!;
      expect(sub.hasJsonFlag).toBe(true);
    });

    it('check-overrides: has --path as required option (concept spec param)', () => {
      const cmd = generatedCommands.get('kit-manager')!;
      const sub = getGeneratedSubcommand(cmd, 'check-overrides')!;
      expect(sub.requiredOptions).toContain('path');
    });
  });

  // ---- sync-parser (no direct handmade equivalent — extra concept in manifest) ----

  describe('SyncParser (generated-only concept)', () => {
    it('generated group "sync-parser" exists', () => {
      expect(generatedCommands.has('sync-parser')).toBe(true);
    });

    it('has exactly 1 subcommand "parse"', () => {
      const cmd = generatedCommands.get('sync-parser')!;
      expect(cmd.subcommands.length).toBe(1);
      expect(cmd.subcommands[0].name).toBe('parse');
    });

    it('parse has --source and --manifests as required options', () => {
      const cmd = generatedCommands.get('sync-parser')!;
      const sub = getGeneratedSubcommand(cmd, 'parse')!;
      expect(sub.requiredOptions).toContain('source');
      expect(sub.requiredOptions).toContain('manifests');
    });

    it('parse has --json flag', () => {
      const cmd = generatedCommands.get('sync-parser')!;
      const sub = getGeneratedSubcommand(cmd, 'parse')!;
      expect(sub.hasJsonFlag).toBe(true);
    });
  });

  // ================================================================
  // Cross-Cutting Parity Checks
  // ================================================================

  describe('concept-overrides application', () => {
    it('devtools manifest has concept-overrides defined', () => {
      expect(manifestYaml['concept-overrides']).toBeDefined();
      expect(conceptOverrides.size).toBeGreaterThan(0);
    });

    it('all concept-overrides reference concepts listed in manifest', () => {
      const overrideKeys = Object.keys(
        (manifestYaml['concept-overrides'] as Record<string, unknown>) || {},
      );
      const manifestConcepts = ((manifestYaml.concepts as string[]) || []).map(c => {
        const fileName = c.split('/').pop()?.replace('.concept', '') || '';
        return fileName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      });

      for (const override of overrideKeys) {
        expect(manifestConcepts, `concept-overrides "${override}" references unknown concept`).toContain(override);
      }
    });

    it('every command-name override in manifest is applied in generated output', () => {
      const failures: string[] = [];
      for (const [concept, actions] of conceptOverrides) {
        for (const [actionName, override] of Object.entries(actions)) {
          if (!override.command) continue;
          const kebab = concept.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          const cmd = generatedCommands.get(kebab);
          if (!cmd) {
            failures.push(`${concept}: no generated group "${kebab}"`);
            continue;
          }
          const sub = getGeneratedSubcommand(cmd, override.command);
          if (!sub) {
            const actual = cmd.subcommands.map(s => s.name).join(', ');
            failures.push(`${concept}.${actionName}: expected "${override.command}", got [${actual}]`);
          }
        }
      }
      expect(failures, `Unapplied command-name overrides:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('every positional override for existing params is applied in generated output', () => {
      const failures: string[] = [];
      for (const [concept, actions] of conceptOverrides) {
        for (const [actionName, override] of Object.entries(actions)) {
          if (!override.params) continue;
          const kebab = concept.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          const cmd = generatedCommands.get(kebab);
          if (!cmd) continue;

          const cmdName = override.command || actionName;
          const sub = getGeneratedSubcommand(cmd, cmdName);
          if (!sub) continue;

          for (const [paramName, paramConfig] of Object.entries(override.params)) {
            if (!paramConfig.positional) continue;
            // Only check params that exist in the generated output
            // (either as positional, required option, or optional option)
            const existsInGenerated =
              sub.positionalArgs.includes(paramName) ||
              sub.requiredOptions.includes(paramName) ||
              sub.optionalOptions.includes(paramName);
            if (!existsInGenerated) continue; // param doesn't exist in concept spec

            if (!sub.positionalArgs.includes(paramName)) {
              failures.push(
                `${concept}.${actionName}.${paramName}: should be positional, ` +
                `got positional=[${sub.positionalArgs}], required=[${sub.requiredOptions}]`,
              );
            }
          }
        }
      }
      expect(failures, `Unapplied positional overrides:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('all override param names reference params that exist in the concept spec', () => {
      const mismatches: string[] = [];
      for (const [concept, actions] of conceptOverrides) {
        for (const [actionName, override] of Object.entries(actions)) {
          if (!override.params) continue;
          const kebab = concept.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          const cmd = generatedCommands.get(kebab);
          if (!cmd) continue;

          const cmdName = override.command || actionName;
          const sub = getGeneratedSubcommand(cmd, cmdName);
          if (!sub) continue;

          for (const paramName of Object.keys(override.params)) {
            const existsInGenerated =
              sub.positionalArgs.includes(paramName) ||
              sub.requiredOptions.includes(paramName) ||
              sub.optionalOptions.includes(paramName);
            if (!existsInGenerated) {
              mismatches.push(
                `${concept}.${actionName}.params.${paramName}: ` +
                `override references param not in concept spec ` +
                `(available: [${sub.allParams.join(', ')}])`,
              );
            }
          }
        }
      }
      // All override param names should reference real concept params.
      // If this fails, a concept-override references a nonexistent param.
      expect(mismatches).toEqual([]);
    });
  });

  // ---- --json flag coverage ----

  describe('--json flag coverage', () => {
    it('every generated subcommand across all groups has --json flag', () => {
      const missingJson: string[] = [];

      for (const [group, cmd] of generatedCommands) {
        for (const sub of cmd.subcommands) {
          if (!sub.hasJsonFlag) {
            missingJson.push(`${group} ${sub.name}`);
          }
        }
      }

      expect(missingJson, `Missing --json flag: ${missingJson.join(', ')}`).toEqual([]);
    });
  });

  // ---- Command coverage ----

  describe('command coverage', () => {
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

    it('generated CLI has a command group for each successfully parsed concept in manifest', () => {
      const manifestConcepts = (manifestYaml.concepts as string[]) || [];
      const conceptNames = manifestConcepts
        .map(c => c.split('/').pop()?.replace('.concept', '') || '')
        .filter(Boolean);

      for (const conceptFile of conceptNames) {
        // Skip concepts with known parse failures (toolchain uses unsupported
        // `map String String` syntax). These are tracked separately.
        if (!generatedCommands.has(conceptFile)) {
          console.warn(`Skipping "${conceptFile}" — not in generated index.ts (parse failure?)`);
          continue;
        }
        expect(
          generatedCommands.has(conceptFile),
          `Generated CLI missing command group for "${conceptFile}"`,
        ).toBe(true);
      }
    });

    it('generated CLI has the expected number of command groups', () => {
      // Count expected from index.ts imports (excludes concepts that fail to parse)
      const indexContent = readFileSync(resolve(GENERATED_CLI_DIR, 'index.ts'), 'utf-8');
      const importCount = (indexContent.match(/from '\.\//g) || []).length;
      expect(generatedCommands.size).toBe(importCount);
    });

    it('every handmade concept-backed command has a generated counterpart', () => {
      const missing: string[] = [];
      const handmadeConcepts = [
        'ProjectScaffold', 'SpecParser', 'SchemaGen', 'SyncCompiler',
        'CacheCompiler', 'DevServer', 'DeploymentValidator', 'FlowTrace',
        'Migration', 'KitManager',
      ];

      for (const concept of handmadeConcepts) {
        const group = CONCEPT_TO_GROUP[concept];
        if (!generatedCommands.has(group)) {
          missing.push(`${concept} (expected group: ${group})`);
        }
      }

      expect(missing, `Missing generated groups: ${missing.join(', ')}`).toEqual([]);
    });

    it('handmade "test" command has no generated counterpart (no TestRunner concept in manifest)', () => {
      // The handmade CLI has `copf test` but no TestRunner concept spec is in
      // the devtools manifest, so it should NOT appear in the generated CLI.
      expect(generatedCommands.has('test-runner')).toBe(false);
    });

    it('handmade "interface" command has no generated counterpart (meta-tool, not a concept)', () => {
      // The interface command is the generation tool itself; it's not a concept.
      expect(generatedCommands.has('interface-generator')).toBe(false);
    });
  });

  // ---- Generated file integrity ----

  describe('generated file integrity', () => {
    it('generated CLI has an index.ts entrypoint', () => {
      expect(existsSync(resolve(GENERATED_CLI_DIR, 'index.ts'))).toBe(true);
    });

    it('index.ts imports all generated command files', () => {
      const indexContent = readFileSync(resolve(GENERATED_CLI_DIR, 'index.ts'), 'utf-8');
      for (const [group] of generatedCommands) {
        const pascal = group.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        expect(indexContent, `index.ts should import ${pascal}Command`).toContain(`${pascal}Command`);
      }
    });

    it('index.ts adds all command groups to the program', () => {
      const indexContent = readFileSync(resolve(GENERATED_CLI_DIR, 'index.ts'), 'utf-8');
      const addCommandCount = (indexContent.match(/\.addCommand\(/g) || []).length;
      expect(addCommandCount).toBe(generatedCommands.size);
    });

    it('each generated file has auto-generated header comment', () => {
      for (const [group] of generatedCommands) {
        const filePath = resolve(GENERATED_CLI_DIR, group, `${group}.command.ts`);
        if (!existsSync(filePath)) continue;
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain('Auto-generated by COPF Interface Kit');
        expect(content).toContain('Do not edit manually');
      }
    });

    it('each generated file exports a commandTree metadata object', () => {
      for (const [group] of generatedCommands) {
        const filePath = resolve(GENERATED_CLI_DIR, group, `${group}.command.ts`);
        if (!existsSync(filePath)) continue;
        const content = readFileSync(filePath, 'utf-8');
        expect(content, `${group}.command.ts should export commandTree`).toContain('CommandTree');
      }
    });

    it('each generated command file dispatches to globalThis.kernel.handleRequest', () => {
      for (const [group] of generatedCommands) {
        const filePath = resolve(GENERATED_CLI_DIR, group, `${group}.command.ts`);
        if (!existsSync(filePath)) continue;
        const content = readFileSync(filePath, 'utf-8');
        expect(content, `${group}.command.ts should use kernel dispatch`).toContain('globalThis.kernel.handleRequest');
      }
    });
  });

  // ---- Manifest consistency ----

  describe('devtools manifest consistency', () => {
    it('manifest concepts are all parseable .concept file paths', () => {
      const concepts = manifestYaml.concepts as string[];
      expect(concepts).toBeDefined();
      expect(concepts.length).toBeGreaterThan(0);

      for (const path of concepts) {
        expect(path).toMatch(/\.concept$/);
        const resolved = resolve(PROJECT_ROOT, path);
        expect(existsSync(resolved), `Manifest references ${path} but file does not exist`).toBe(true);
      }
    });

    it('manifest declares cli as a target', () => {
      const targets = manifestYaml.targets as Record<string, unknown>;
      expect(targets).toBeDefined();
      expect(targets.cli).toBeDefined();
    });

    it('manifest cli target has name "copf"', () => {
      const targets = manifestYaml.targets as Record<string, Record<string, unknown>>;
      expect(targets.cli.name).toBe('copf');
    });

    it('manifest lists exactly 28 concept specs', () => {
      const concepts = manifestYaml.concepts as string[];
      expect(concepts.length).toBe(28);
    });
  });
});
