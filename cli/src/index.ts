import { Command } from 'commander';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { conceptScaffoldGenHandler } from '../../handlers/ts/framework/concept-scaffold-gen.handler.js';
import { handlerScaffoldGenHandler } from '../../handlers/ts/framework/handler-scaffold-gen.handler.js';
import { parseConceptFile } from '../../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../../handlers/ts/framework/sync-parser.handler.js';
import { syncScaffoldGenHandler } from '../../handlers/ts/framework/sync-scaffold-gen.handler.js';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { verifyCommand } from './verify/verify.command.js';
import type { ConceptAST } from '../../runtime/types.js';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const storage = createInMemoryStorage();

type ScaffoldResult = Awaited<ReturnType<NonNullable<typeof conceptScaffoldGenHandler.generate>>>;

function collectFiles(root: string, extension: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
      continue;
    }

    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, extension));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

function resolveExistingPath(input: string): string | null {
  const candidates = [
    resolve(process.cwd(), input),
    resolve(ROOT, input),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function readSourceArgument(input: string): { source: string; path?: string } {
  const path = resolveExistingPath(input);
  if (!path) {
    return { source: input };
  }

  return {
    source: readFileSync(path, 'utf8'),
    path,
  };
}

function loadAllConceptManifests(): ConceptAST[] {
  const conceptFiles = [
    ...collectFiles(resolve(ROOT, 'specs'), '.concept'),
    ...collectFiles(resolve(ROOT, 'repertoire'), '.concept'),
  ];

  const manifests: ConceptAST[] = [];

  for (const file of conceptFiles) {
    try {
      manifests.push(parseConceptFile(readFileSync(file, 'utf8')));
    } catch {
      // Keep the compatibility CLI permissive: unrelated parse failures
      // should not block validating the file the user explicitly asked about.
    }
  }

  return manifests;
}

function readJsonConfig(configPath: string): Record<string, unknown> {
  const path = resolveExistingPath(configPath) ?? resolve(process.cwd(), configPath);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function emitScaffoldFiles(result: ScaffoldResult, write: boolean): void {
  if (result.variant !== 'ok') {
    throw new Error(result.message);
  }

  const files = result.files as Array<{ path: string; content: string }>;
  for (const file of files) {
    const destination = resolve(ROOT, file.path.replace(/\.stub(?=\.)/, ''));
    if (write) {
      mkdirSync(resolve(destination, '..'), { recursive: true });
      writeFileSync(destination, file.content, 'utf8');
    }
    console.log(write ? `wrote ${relative(ROOT, destination)}` : `preview ${file.path}`);
  }
}

export function buildCli(): Command {
  const program = new Command();
  program.name('clef');

  program
    .command('check')
    .description('Validate one concept file or all concept files in the workspace.')
    .argument('[target]', 'Concept file path or inline source')
    .option('--json', 'Output JSON')
    .action((target?: string, options?: { json?: boolean }) => {
      const files = target
        ? [readSourceArgument(target)]
        : collectFiles(resolve(ROOT, 'specs'), '.concept')
            .concat(collectFiles(resolve(ROOT, 'repertoire'), '.concept'))
            .map((file) => ({ source: readFileSync(file, 'utf8'), path: file }));

      const results = files.map(({ source, path }) => ({
        path: path ? relative(ROOT, path) : '<inline>',
        ast: parseConceptFile(source),
      }));

      if (options?.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      for (const result of results) {
        console.log(`ok ${result.path} -> ${result.ast.name}`);
      }
    });

  const specParser = new Command('spec-parser').description('Parse concept files into structured ASTs.');
  specParser
    .command('check')
    .description('Validate a concept file or inline concept source.')
    .argument('<source>', 'Concept file path or inline concept source')
    .option('--json', 'Output JSON')
    .action((sourceInput: string, options?: { json?: boolean }) => {
      const source = readSourceArgument(sourceInput);
      const ast = parseConceptFile(source.source);
      const result = { path: source.path ? relative(ROOT, source.path) : '<inline>', ast };
      console.log(options?.json ? JSON.stringify(result, null, 2) : `ok ${result.path} -> ${ast.name}`);
    });
  program.addCommand(specParser);

  program
    .command('compile-syncs')
    .description('Validate one sync file or all sync files in the workspace.')
    .argument('[target]', 'Sync file path or inline source')
    .option('--json', 'Output JSON')
    .action((target?: string, options?: { json?: boolean }) => {
      const manifests = loadAllConceptManifests();
      const files = target
        ? [readSourceArgument(target)]
        : collectFiles(resolve(ROOT, 'syncs'), '.sync')
            .concat(collectFiles(resolve(ROOT, 'repertoire'), '.sync'))
            .map((file) => ({ source: readFileSync(file, 'utf8'), path: file }));

      const results = files.map(({ source, path }) => ({
        path: path ? relative(ROOT, path) : '<inline>',
        syncs: parseSyncFile(source),
        manifestsLoaded: manifests.length,
      }));

      if (options?.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      for (const result of results) {
        console.log(`ok ${result.path} -> ${result.syncs.map((sync) => sync.name).join(', ')}`);
      }
    });

  const syncParser = new Command('sync-parser').description('Parse sync files into structured ASTs.');
  syncParser
    .command('parse')
    .description('Validate a sync file or inline sync source.')
    .requiredOption('--source <source>', 'Sync file path or inline sync source')
    .option('--json', 'Output JSON')
    .action((options: { source: string; json?: boolean }) => {
      const source = readSourceArgument(options.source);
      const syncs = parseSyncFile(source.source);
      const result = {
        path: source.path ? relative(ROOT, source.path) : '<inline>',
        manifestsLoaded: loadAllConceptManifests().length,
        syncs,
      };
      console.log(options.json ? JSON.stringify(result, null, 2) : `ok ${result.path} -> ${syncs.map((sync) => sync.name).join(', ')}`);
    });
  program.addCommand(syncParser);

  const conceptScaffold = new Command('concept-scaffold-gen').description('Generate concept scaffolds.');
  conceptScaffold
    .command('generate')
    .requiredOption('--config <path>', 'JSON config file for the concept scaffold')
    .option('--write', 'Write the generated files into the workspace')
    .action(async (options: { config: string; write?: boolean }) => {
      const result = await conceptScaffoldGenHandler.generate!(readJsonConfig(options.config), storage);
      emitScaffoldFiles(result, Boolean(options.write));
    });
  program.addCommand(conceptScaffold);

  const syncScaffold = new Command('sync-scaffold-gen').description('Generate sync scaffolds.');
  syncScaffold
    .command('generate')
    .requiredOption('--config <path>', 'JSON config file for the sync scaffold')
    .option('--write', 'Write the generated files into the workspace')
    .action(async (options: { config: string; write?: boolean }) => {
      const result = await syncScaffoldGenHandler.generate!(readJsonConfig(options.config), storage);
      emitScaffoldFiles(result, Boolean(options.write));
    });
  program.addCommand(syncScaffold);

  const handlerScaffold = new Command('handler-scaffold-gen').description('Generate handler scaffolds.');
  handlerScaffold
    .command('generate')
    .requiredOption('--config <path>', 'JSON config file for the handler scaffold')
    .option('--write', 'Write the generated files into the workspace')
    .action(async (options: { config: string; write?: boolean }) => {
      const result = await handlerScaffoldGenHandler.generate!(readJsonConfig(options.config), storage);
      emitScaffoldFiles(result, Boolean(options.write));
    });
  program.addCommand(handlerScaffold);

  program.addCommand(verifyCommand);

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  await buildCli().parseAsync(argv);
}

export default buildCli;
