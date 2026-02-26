// ============================================================
// TypeScript SDK Target Provider — Interface Kit
//
// Generates TypeScript client classes from ConceptManifest data.
// Each concept produces a {kebab-name}/client.ts file with a
// typed async client class. Package-level files are generated
// when allProjections is provided.
// Architecture doc: Interface Kit
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
  ActionParamSchema,
  VariantSchema,
} from '../../../../kernel/src/types.js';

import {
  typeToTypeScript,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  generateFileHeader,
  inferHttpRoute,
} from './codegen-utils.js';

// --- Internal Types ---

interface GeneratedFile {
  path: string;
  content: string;
}

interface ProjectionEntry {
  conceptManifest: string;
  conceptName: string;
}

// --- Input Type Generation ---

/**
 * Generate a TypeScript inline type for action input parameters.
 */
function generateInputType(params: ActionParamSchema[]): string {
  if (params.length === 0) return '{}';
  const fields = params.map(
    (p) => `${p.name}: ${typeToTypeScript(p.type)}`,
  );
  return `{ ${fields.join('; ')} }`;
}

/**
 * Generate a TypeScript inline type for an action's return type.
 * If the action has a single variant, return its fields directly.
 * If multiple variants, return a discriminated union.
 */
function generateOutputType(variants: VariantSchema[], actionName: string, conceptName: string): string {
  if (variants.length === 0) return '{ variant: string }';
  if (variants.length === 1) {
    const v = variants[0];
    const fields = v.fields.map((f) => `${f.name}: ${typeToTypeScript(f.type)}`);
    return `{ ${fields.join('; ')} }`;
  }
  const parts = variants.map((v) => {
    const fields = v.fields.map((f) => `${f.name}: ${typeToTypeScript(f.type)}`);
    return `{ variant: '${v.tag}'; ${fields.join('; ')} }`;
  });
  return parts.join(' | ');
}

// --- Client Method Generation ---

/**
 * Generate a single async method for the client class.
 */
function generateMethod(
  action: ActionSchema,
  basePath: string,
  conceptName: string,
): string {
  const route = inferHttpRoute(action.name, basePath);
  const methodName = toCamelCase(action.name);
  const inputType = generateInputType(action.params);
  const outputType = generateOutputType(action.variants, action.name, conceptName);
  const lines: string[] = [];

  if (route.method === 'GET' || route.method === 'DELETE') {
    if (route.path.includes('{id}')) {
      // Single-resource action: first param is the id
      const idParam = action.params.length > 0 ? action.params[0].name : 'id';
      lines.push(`  async ${methodName}(${idParam}: string): Promise<${outputType}> {`);
      lines.push(`    const res = await fetch(\`\${this.baseUrl}${route.path.replace('{id}', `\${${idParam}}`)}\`, {`);
      lines.push(`      method: '${route.method}',`);
      lines.push(`      headers: this.headers,`);
      lines.push(`    });`);
    } else {
      // List-style action: params become query string
      if (action.params.length > 0) {
        lines.push(`  async ${methodName}(input: ${inputType}): Promise<${outputType}> {`);
        lines.push(`    const params = new URLSearchParams();`);
        for (const p of action.params) {
          lines.push(`    if (input.${p.name} !== undefined) params.set('${p.name}', String(input.${p.name}));`);
        }
        lines.push(`    const res = await fetch(\`\${this.baseUrl}${route.path}?\${params}\`, {`);
        lines.push(`      method: '${route.method}',`);
        lines.push(`      headers: this.headers,`);
        lines.push(`    });`);
      } else {
        lines.push(`  async ${methodName}(): Promise<${outputType}> {`);
        lines.push(`    const res = await fetch(\`\${this.baseUrl}${route.path}\`, {`);
        lines.push(`      method: '${route.method}',`);
        lines.push(`      headers: this.headers,`);
        lines.push(`    });`);
      }
    }
  } else {
    // POST / PUT — JSON body
    lines.push(`  async ${methodName}(input: ${inputType}): Promise<${outputType}> {`);
    lines.push(`    const res = await fetch(\`\${this.baseUrl}${route.path.replace('{id}', `\${(input as Record<string, unknown>).id ?? ''}`)}\`, {`);
    lines.push(`      method: '${route.method}',`);
    lines.push(`      headers: { 'Content-Type': 'application/json', ...this.headers },`);
    lines.push(`      body: JSON.stringify(input),`);
    lines.push(`    });`);
  }

  lines.push(`    if (!res.ok) throw new Error(\`${methodName} failed: \${res.status}\`);`);
  lines.push(`    return res.json();`);
  lines.push(`  }`);

  return lines.join('\n');
}

// --- Full Client File Generation ---

/**
 * Generate the complete TypeScript client file for a single concept.
 */
function generateClientFile(manifest: ConceptManifest): { content: string; fileName: string } {
  const header = generateFileHeader('typescript-sdk', manifest.name);
  const className = `${toPascalCase(manifest.name)}Client`;
  const kebabName = toKebabCase(manifest.name);
  const basePath = `/api/${kebabName}s`;

  const methods = manifest.actions.map((a) => generateMethod(a, basePath, manifest.name));

  const body = [
    header,
    '',
    `export class ${className} {`,
    `  constructor(private baseUrl: string, private headers: Record<string, string> = {}) {}`,
    '',
    methods.join('\n\n'),
    `}`,
    '',
  ].join('\n');

  return { content: body, fileName: `${kebabName}/client.ts` };
}

// --- Package-Level File Generation ---

function generatePackageJson(packageName: string, conceptNames: string[]): string {
  return JSON.stringify(
    {
      name: packageName,
      version: '0.1.0',
      description: `Auto-generated TypeScript SDK client — Clef Interface Kit`,
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      scripts: {
        build: 'tsc',
        prepublishOnly: 'npm run build',
      },
      dependencies: {},
      devDependencies: {
        typescript: '^5.4.0',
      },
    },
    null,
    2,
  );
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        declaration: true,
        outDir: './dist',
        rootDir: '.',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ['./**/*.ts'],
    },
    null,
    2,
  );
}

function generateIndexTs(projections: ProjectionEntry[]): string {
  const lines: string[] = [
    '// Auto-generated by Clef Interface Kit — typescript-sdk target',
    '// Package index: re-exports all concept clients',
    '',
  ];

  for (const proj of projections) {
    const kebabName = toKebabCase(proj.conceptName);
    const className = `${toPascalCase(proj.conceptName)}Client`;
    lines.push(`export { ${className} } from './${kebabName}/client.js';`);
  }

  lines.push('');
  return lines.join('\n');
}

// --- Concept Handler ---

export const tsSdkTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'TsSdkTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'TypeScriptSdk',
      capabilities: JSON.stringify(['client', 'types', 'tests']),
      targetKey: 'typescript',
      providerType: 'sdk',
    };
  },

  /**
   * Generate TypeScript SDK client files from ConceptManifest projections.
   *
   * Input fields:
   *   - projection:     JSON string containing { conceptManifest, conceptName }
   *   - config:         JSON string of SDK config (packageName, etc.)
   *   - allProjections: JSON string array of all concept projections (for package files)
   *
   * Returns variant 'ok' with generated files and package name.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // --- Parse projection ---
    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      return { variant: 'error', reason: 'projection is required and must be a JSON string' };
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw) as Record<string, unknown>;
    } catch {
      return { variant: 'error', reason: 'projection is not valid JSON' };
    }

    const manifestRaw = projection.conceptManifest as string;
    if (!manifestRaw || typeof manifestRaw !== 'string') {
      return { variant: 'error', reason: 'projection.conceptManifest is required and must be a JSON string' };
    }

    let manifest: ConceptManifest;
    try {
      manifest = JSON.parse(manifestRaw) as ConceptManifest;
    } catch {
      return { variant: 'error', reason: 'conceptManifest is not valid JSON' };
    }

    const conceptName = (projection.conceptName as string) || manifest.name;

    // --- Parse config ---
    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as Record<string, unknown>;
      } catch {
        // Non-fatal: use defaults
      }
    }

    const packageName = (config.packageName as string) || '@clef/sdk-ts';

    // --- Validate manifest ---
    if (!manifest.actions || manifest.actions.length === 0) {
      return { variant: 'ok', files: [], package: packageName };
    }

    // --- Generate concept client file ---
    const files: GeneratedFile[] = [];
    const { content, fileName } = generateClientFile(manifest);
    files.push({ path: fileName, content });

    // --- Generate package-level files when allProjections is provided ---
    if (input.allProjections && typeof input.allProjections === 'string') {
      let allProjections: ProjectionEntry[] = [];
      try {
        const rawArray = JSON.parse(input.allProjections) as string[];
        allProjections = rawArray.map((raw) => {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return {
            conceptManifest: parsed.conceptManifest as string,
            conceptName: (parsed.conceptName as string) || '',
          };
        });
      } catch {
        // Non-fatal: skip package files
      }

      if (allProjections.length > 0) {
        // Resolve concept names from manifests if not present
        for (const proj of allProjections) {
          if (!proj.conceptName && proj.conceptManifest) {
            try {
              const m = JSON.parse(proj.conceptManifest) as ConceptManifest;
              proj.conceptName = m.name;
            } catch {
              // skip
            }
          }
        }

        files.push({ path: 'package.json', content: generatePackageJson(packageName, allProjections.map((p) => p.conceptName)) });
        files.push({ path: 'tsconfig.json', content: generateTsConfig() });
        files.push({ path: 'index.ts', content: generateIndexTs(allProjections) });
      }
    }

    return { variant: 'ok', files, package: packageName };
  },
};
