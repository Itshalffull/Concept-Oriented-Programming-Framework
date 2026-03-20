// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Python SDK Target Provider — Clef Bind
//
// Generates Python async client classes from ConceptManifest data.
// Each concept produces a {snake_name}/client.py file with a
// typed async client using httpx. Package-level files are
// generated when allProjections is provided.
// Architecture doc: Clef Bind
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

import type {
  ConceptManifest,
  ActionSchema,
  ActionParamSchema,
  VariantSchema,
} from '../../../../runtime/types.js';

import {
  typeToPython,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  generateFileHeader,
  inferHttpRoute,
} from './codegen-utils.js';

// --- Internal Types ---

interface GeneratedFile { path: string; content: string; }
interface ProjectionEntry { conceptManifest: string; conceptName: string; }

type Result = { variant: string; [key: string]: unknown };

// --- Python Type Annotation Generation ---

function generatePythonParams(params: ActionParamSchema[]): string {
  if (params.length === 0) return '';
  return params.map((p) => `${toSnakeCase(p.name)}: ${typeToPython(p.type)}`).join(', ');
}

function generatePythonJsonBody(params: ActionParamSchema[]): string {
  if (params.length === 0) return '{}';
  const entries = params.map((p) => `"${p.name}": ${toSnakeCase(p.name)}`);
  return `{${entries.join(', ')}}`;
}

// --- Client Method Generation ---

function generateMethod(action: ActionSchema, basePath: string, indent: string): string {
  const route = inferHttpRoute(action.name, basePath);
  const methodName = toSnakeCase(action.name);
  const params = generatePythonParams(action.params);
  const lines: string[] = [];

  if (route.method === 'GET' || route.method === 'DELETE') {
    if (route.path.includes('{id}')) {
      const idParam = action.params.length > 0 ? toSnakeCase(action.params[0].name) : 'id';
      lines.push(`${indent}async def ${methodName}(self, ${idParam}: str) -> dict:`);
      lines.push(`${indent}    """${action.name} — ${route.method} ${route.path}"""`);
      lines.push(`${indent}    async with httpx.AsyncClient() as client:`);
      lines.push(`${indent}        resp = await client.${route.method.toLowerCase()}(`);
      lines.push(`${indent}            f"{self.base_url}${route.path.replace('{id}', `{${idParam}}`)}",`);
      lines.push(`${indent}            headers=self.headers,`);
      lines.push(`${indent}        )`);
      lines.push(`${indent}        resp.raise_for_status()`);
      lines.push(`${indent}        return resp.json()`);
    } else {
      if (action.params.length > 0) {
        lines.push(`${indent}async def ${methodName}(self, ${params}) -> dict:`);
        lines.push(`${indent}    """${action.name} — ${route.method} ${route.path}"""`);
        const queryDict = action.params.map((p) => `"${p.name}": ${toSnakeCase(p.name)}`).join(', ');
        lines.push(`${indent}    async with httpx.AsyncClient() as client:`);
        lines.push(`${indent}        resp = await client.${route.method.toLowerCase()}(`);
        lines.push(`${indent}            f"{self.base_url}${route.path}",`);
        lines.push(`${indent}            params={${queryDict}},`);
        lines.push(`${indent}            headers=self.headers,`);
        lines.push(`${indent}        )`);
        lines.push(`${indent}        resp.raise_for_status()`);
        lines.push(`${indent}        return resp.json()`);
      } else {
        lines.push(`${indent}async def ${methodName}(self) -> dict:`);
        lines.push(`${indent}    """${action.name} — ${route.method} ${route.path}"""`);
        lines.push(`${indent}    async with httpx.AsyncClient() as client:`);
        lines.push(`${indent}        resp = await client.${route.method.toLowerCase()}(`);
        lines.push(`${indent}            f"{self.base_url}${route.path}",`);
        lines.push(`${indent}            headers=self.headers,`);
        lines.push(`${indent}        )`);
        lines.push(`${indent}        resp.raise_for_status()`);
        lines.push(`${indent}        return resp.json()`);
      }
    }
  } else {
    lines.push(`${indent}async def ${methodName}(self, ${params}) -> dict:`);
    lines.push(`${indent}    """${action.name} — ${route.method} ${route.path}"""`);
    const jsonBody = generatePythonJsonBody(action.params);
    lines.push(`${indent}    async with httpx.AsyncClient() as client:`);
    lines.push(`${indent}        resp = await client.${route.method.toLowerCase()}(`);
    if (route.path.includes('{id}')) {
      const idParam = action.params.length > 0 ? toSnakeCase(action.params[0].name) : 'id';
      lines.push(`${indent}            f"{self.base_url}${route.path.replace('{id}', `{${idParam}}`)}",`);
    } else {
      lines.push(`${indent}            f"{self.base_url}${route.path}",`);
    }
    lines.push(`${indent}            json=${jsonBody},`);
    lines.push(`${indent}            headers={**self.headers, "Content-Type": "application/json"},`);
    lines.push(`${indent}        )`);
    lines.push(`${indent}        resp.raise_for_status()`);
    lines.push(`${indent}        return resp.json()`);
  }

  return lines.join('\n');
}

function generateClientFile(manifest: ConceptManifest): { content: string; fileName: string } {
  const header = `# Auto-generated by Clef Clef Bind — python-sdk target\n# Concept: ${manifest.name}\n# Do not edit manually; regenerate with: clef interface generate`;
  const className = `${toPascalCase(manifest.name)}Client`;
  const snakeName = toSnakeCase(manifest.name);
  const basePath = `/api/${toKebabCase(manifest.name)}s`;
  const methods = manifest.actions.map((a) => generateMethod(a, basePath, '    '));
  const body = [header, '', 'from __future__ import annotations', '', 'import httpx', '', '',
    `class ${className}:`, `    """Async HTTP client for the ${manifest.name} concept."""`, '',
    `    def __init__(self, base_url: str, headers: dict[str, str] | None = None) -> None:`,
    `        self.base_url = base_url.rstrip("/")`, `        self.headers = headers or {}`, '',
    methods.join('\n\n'), ''].join('\n');
  return { content: body, fileName: `${snakeName}/client.py` };
}

function generatePyprojectToml(packageName: string, conceptNames: string[]): string {
  const safeName = packageName.replace(/@/g, '').replace(/\//g, '-');
  return ['[build-system]', 'requires = ["hatchling"]', 'build-backend = "hatchling.build"', '',
    '[project]', `name = "${safeName}"`, 'version = "0.1.0"',
    'description = "Auto-generated Python SDK client — Clef Clef Bind"',
    'requires-python = ">=3.10"', 'dependencies = ["httpx>=0.27"]', '',
    '[project.optional-dependencies]', 'dev = ["pytest", "pytest-asyncio"]', ''].join('\n');
}

function generateInitPy(projections: ProjectionEntry[]): string {
  const lines: string[] = ['# Auto-generated by Clef Clef Bind — python-sdk target',
    '# Package __init__: re-exports all concept clients', ''];
  for (const proj of projections) {
    const snakeName = toSnakeCase(proj.conceptName);
    const className = `${toPascalCase(proj.conceptName)}Client`;
    lines.push(`from .${snakeName}.client import ${className}`);
  }
  lines.push('');
  lines.push('__all__ = [');
  for (const proj of projections) {
    const className = `${toPascalCase(proj.conceptName)}Client`;
    lines.push(`    "${className}",`);
  }
  lines.push(']');
  lines.push('');
  return lines.join('\n');
}

// --- Concept Handler ---

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'PySdkTarget', inputKind: 'InterfaceProjection', outputKind: 'PythonSdk',
      capabilities: JSON.stringify(['client', 'types', 'pyproject']),
      targetKey: 'python', providerType: 'sdk',
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      const p = createProgram();
      return complete(p, 'error', { reason: 'projection is required and must be a JSON string' }) as StorageProgram<Result>;
    }

    let projection: Record<string, unknown>;
    try { projection = JSON.parse(projectionRaw) as Record<string, unknown>; }
    catch { const p = createProgram(); return complete(p, 'error', { reason: 'projection is not valid JSON' }) as StorageProgram<Result>; }

    const manifestRaw = projection.conceptManifest as string;
    if (!manifestRaw || typeof manifestRaw !== 'string') {
      const p = createProgram();
      return complete(p, 'error', { reason: 'projection.conceptManifest is required and must be a JSON string' }) as StorageProgram<Result>;
    }

    let manifest: ConceptManifest;
    try { manifest = JSON.parse(manifestRaw) as ConceptManifest; }
    catch { const p = createProgram(); return complete(p, 'error', { reason: 'conceptManifest is not valid JSON' }) as StorageProgram<Result>; }

    const conceptName = (projection.conceptName as string) || manifest.name;

    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try { config = JSON.parse(input.config) as Record<string, unknown>; } catch { /* */ }
    }
    const packageName = (config.packageName as string) || 'clef-sdk-py';

    if (!manifest.actions || manifest.actions.length === 0) {
      const p = createProgram();
      return complete(p, 'ok', { files: [], package: packageName }) as StorageProgram<Result>;
    }

    const files: GeneratedFile[] = [];
    const { content, fileName } = generateClientFile(manifest);
    files.push({ path: fileName, content });

    if (input.allProjections && typeof input.allProjections === 'string') {
      let allProjections: ProjectionEntry[] = [];
      try {
        const rawArray = JSON.parse(input.allProjections) as string[];
        allProjections = rawArray.map((raw) => {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return { conceptManifest: parsed.conceptManifest as string, conceptName: (parsed.conceptName as string) || '' };
        });
      } catch { /* */ }

      if (allProjections.length > 0) {
        for (const proj of allProjections) {
          if (!proj.conceptName && proj.conceptManifest) {
            try { const m = JSON.parse(proj.conceptManifest) as ConceptManifest; proj.conceptName = m.name; } catch { /* */ }
          }
        }
        files.push({ path: 'pyproject.toml', content: generatePyprojectToml(packageName, allProjections.map((p) => p.conceptName)) });
        files.push({ path: '__init__.py', content: generateInitPy(allProjections) });
        files.push({ path: 'py.typed', content: '# Marker file for PEP 561\n' });
      }
    }

    const p = createProgram();
    return complete(p, 'ok', { files, package: packageName }) as StorageProgram<Result>;
  },
};

export const pySdkTargetHandler = autoInterpret(_handler);
