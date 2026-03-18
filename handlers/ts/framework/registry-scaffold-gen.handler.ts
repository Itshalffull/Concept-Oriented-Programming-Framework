// @migrated dsl-constructs 2026-03-18
// ============================================================
// RegistryScaffoldGen — Kernel registry boot code generator
//
// Reads a deploy.yaml manifest and produces a static TypeScript
// (or other language) file containing handler imports, a typed
// RegistryEntry[] array, and a SYNC_FILES[] array. This replaces
// hand-maintained import lists in kernel.ts with a single
// generated source-of-truth derived from the deployment manifest.
// ============================================================

import { readFileSync } from 'fs';
import { resolve, dirname, relative, posix } from 'path';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// --- Helpers ----------------------------------------------------------------

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toCamel(kebab: string): string {
  return kebab
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

/** Derive the export name from a handler filename: content-node.handler.ts → contentNodeHandler */
function deriveExportName(handlerPath: string): string {
  const filename = handlerPath.split('/').pop() ?? handlerPath;
  const stem = filename.replace(/\.handler\.(ts|js)$/, '');
  return toCamel(stem) + 'Handler';
}

/** Derive storageName from concept key unless overridden */
function deriveStorageName(key: string, explicit?: string): string {
  if (explicit) return explicit;
  return toKebab(key);
}

/** Map deploy.yaml storage backend to registry storageType */
function deriveStorageType(storage: string, explicitType?: string): 'standard' | 'identity' | 'none' {
  if (explicitType === 'identity') return 'identity';
  if (storage === 'memory' || !storage) return 'none';
  return 'standard';
}

/** Convert a Windows-style path to posix for import statements */
function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Compute a relative import path from outputDir to handlerPath */
function computeImportPath(outputDir: string, handlerPath: string, projectRoot: string): string {
  const absHandler = resolve(projectRoot, handlerPath).replace(/\.(ts|js)$/, '');
  const rel = toPosixPath(relative(outputDir, absHandler));
  return rel.startsWith('.') ? rel : './' + rel;
}

// --- Concept entry parsed from deploy.yaml ----------------------------------

interface DeployConceptEntry {
  key: string;
  uri: string;
  handlerPath: string;
  exportName: string;
  storageName: string;
  storageType: 'standard' | 'identity' | 'none';
}

interface DeploySyncEntry {
  path: string;
}

// --- Code generation --------------------------------------------------------

function generateTypeScript(concepts: DeployConceptEntry[], syncs: DeploySyncEntry[], outputPath: string, projectRoot: string): string {
  const outputDir = dirname(resolve(projectRoot, outputPath));
  const lines: string[] = [];

  lines.push("// Auto-generated from deploy.yaml — do not edit");
  lines.push("import type { ConceptHandler } from '../runtime/types';");
  lines.push('');

  // Import statements
  for (const c of concepts) {
    const importPath = computeImportPath(outputDir, c.handlerPath, projectRoot);
    lines.push(`import { ${c.exportName} } from '${importPath}';`);
  }
  lines.push('');

  // RegistryEntry interface
  lines.push('export interface RegistryEntry {');
  lines.push('  uri: string;');
  lines.push('  handler: ConceptHandler;');
  lines.push('  storageName: string;');
  lines.push("  storageType: 'standard' | 'identity' | 'none';");
  lines.push('}');
  lines.push('');

  // REGISTRY_ENTRIES array
  lines.push('export const REGISTRY_ENTRIES: RegistryEntry[] = [');
  for (const c of concepts) {
    lines.push(`  { uri: '${c.uri}', handler: ${c.exportName}, storageName: '${c.storageName}', storageType: '${c.storageType}' },`);
  }
  lines.push('];');
  lines.push('');

  // SYNC_FILES array
  lines.push('export const SYNC_FILES: string[] = [');
  for (const s of syncs) {
    lines.push(`  '${s.path}',`);
  }
  lines.push('];');
  lines.push('');

  return lines.join('\n');
}

// --- Manifest parsing -------------------------------------------------------

function parseDeployManifest(content: string): { concepts: DeployConceptEntry[]; syncs: DeploySyncEntry[] } {
  // Use dynamic import to avoid hard dependency on yaml package at module level
  // For synchronous operation, use a simple YAML subset parser for deploy manifests
  const manifest = parseSimpleYaml(content);

  const conceptsSection = manifest.concepts as Record<string, Record<string, unknown>> | undefined;
  const syncsSection = manifest.syncs as Array<Record<string, unknown>> | undefined;

  const concepts: DeployConceptEntry[] = [];
  const syncs: DeploySyncEntry[] = [];

  if (conceptsSection) {
    for (const [key, value] of Object.entries(conceptsSection)) {
      const impls = value.implementations as Array<Record<string, unknown>> | undefined;
      const tsImpl = impls?.find(i => (i.language as string) === 'typescript') ?? impls?.[0];
      if (!tsImpl) continue;

      const handlerPath = tsImpl.path as string;
      const storage = (tsImpl.storage as string) || 'memory';
      const explicitStorageName = value.storageName as string | undefined;
      const explicitStorageType = value.storageType as string | undefined;

      concepts.push({
        key,
        uri: `urn:clef/${key}`,
        handlerPath,
        exportName: deriveExportName(handlerPath),
        storageName: deriveStorageName(key, explicitStorageName),
        storageType: deriveStorageType(storage, explicitStorageType),
      });
    }
  }

  if (syncsSection) {
    for (const entry of syncsSection) {
      if (entry.path) {
        syncs.push({ path: entry.path as string });
      }
    }
  }

  return { concepts, syncs };
}

/**
 * Minimal YAML parser sufficient for deploy.yaml manifests.
 * Handles nested maps, arrays of maps, and scalar values.
 * For production use, prefer the `yaml` npm package.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  try {
    // Try dynamic require of yaml package (available at build time)
    const yaml = require('yaml');
    return yaml.parse(content);
  } catch {
    // Fallback: use a very basic line parser
    return parseYamlFallback(content);
  }
}

function parseYamlFallback(content: string): Record<string, unknown> {
  const lines = content.split('\n');
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> | unknown[] }> = [{ indent: -1, obj: root }];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.replace(/\r$/, '');
    if (!trimmed.trim() || trimmed.trim().startsWith('#')) continue;

    const indent = trimmed.search(/\S/);
    const line = trimmed.trim();

    // Pop stack to find parent at correct indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    // Array item: - key: value or - path: value
    if (line.startsWith('- ')) {
      const itemContent = line.slice(2).trim();
      if (!Array.isArray(parent)) {
        // Parent is a map — the current key should become an array
        continue;
      }
      if (itemContent.includes(':')) {
        const colonIdx = itemContent.indexOf(':');
        const k = itemContent.slice(0, colonIdx).trim();
        const v = itemContent.slice(colonIdx + 1).trim();
        const obj: Record<string, unknown> = { [k]: unquote(v) };
        parent.push(obj);
        stack.push({ indent: indent + 2, obj });
      } else {
        parent.push(unquote(itemContent));
      }
      continue;
    }

    // Key: value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const valuePart = line.slice(colonIdx + 1).trim();

    if (typeof parent !== 'object' || Array.isArray(parent)) continue;

    if (valuePart === '' || valuePart === '|' || valuePart === '>') {
      // Check if next meaningful line is an array item
      let nextIdx = i + 1;
      while (nextIdx < lines.length && (!lines[nextIdx].trim() || lines[nextIdx].trim().startsWith('#'))) nextIdx++;
      if (nextIdx < lines.length && lines[nextIdx].trim().startsWith('- ')) {
        const arr: unknown[] = [];
        parent[key] = arr;
        stack.push({ indent, obj: arr });
      } else {
        const obj: Record<string, unknown> = {};
        parent[key] = obj;
        stack.push({ indent, obj });
      }
    } else {
      parent[key] = unquote(valuePart);
    }
  }

  return root;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// --- Handler ----------------------------------------------------------------

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    { let p = createProgram(); p = complete(p, 'ok', { name: 'RegistryScaffoldGen',
      inputKind: 'DeployManifest',
      outputKind: 'KernelRegistry',
      capabilities: JSON.stringify(['registry-ts', 'boot-code', 'import-map']) }); return p; }
  },

  generate(input: Record<string, unknown>) {
    const deployManifestPath = input.deployManifest as string;
    const outputPath = (input.outputPath as string) || 'generated/kernel-registry.ts';
    const language = (input.language as string) || 'typescript';

    if (!deployManifestPath) {
      { let p = createProgram(); p = complete(p, 'error', { message: 'deployManifest path is required' }); return p; }
    }

    if (language !== 'typescript') {
      { let p = createProgram(); p = complete(p, 'error', { message: `Language "${language}" is not yet supported. Only "typescript" is available.` }); return p; }
    }

    try {
      const projectRoot = resolve(dirname(deployManifestPath), '..');
      const manifestContent = readFileSync(deployManifestPath, 'utf-8');
      const { concepts, syncs } = parseDeployManifest(manifestContent);

      if (concepts.length === 0) {
        { let p = createProgram(); p = complete(p, 'error', { message: 'No concepts found in deploy manifest' }); return p; }
      }

      const content = generateTypeScript(concepts, syncs, outputPath, projectRoot);
      const files = [{ path: outputPath, content }];

      { let p = createProgram(); p = complete(p, 'ok', { files: JSON.stringify(files), filesGenerated: files.length }); return p; }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      { let p = createProgram(); p = complete(p, 'error', { message }); return p; }
    }
  },

  preview(input: Record<string, unknown>) {
    const result = await registryScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = typeof result.files === 'string' ? JSON.parse(result.files) : result.files;
    { let p = createProgram(); p = complete(p, 'ok', { files: result.files,
      wouldWrite: Array.isArray(files) ? files.length : 0,
      wouldSkip: 0 }); return p; }
  },
};

export const registryScaffoldGenHandler = autoInterpret(_handler);
