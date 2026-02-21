// TsSdkTarget Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const tsSdkTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const packageName = (parsedConfig.packageName as string) || '@copf/sdk';
    const runtime = (parsedConfig.runtime as string) || 'node';
    const moduleSystem = (parsedConfig.moduleSystem as string) || 'esm';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const typeName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    const typesFile = [
      `// Generated types for ${typeName} SDK`,
      ``,
      `export interface ${typeName} {`,
      `  id: string;`,
      `  name: string;`,
      `  createdAt: string;`,
      `  updatedAt: string;`,
      `}`,
      ``,
      `export interface Create${typeName}Input {`,
      `  name: string;`,
      `}`,
      ``,
      `export interface Update${typeName}Input {`,
      `  name?: string;`,
      `}`,
      ``,
      `export type ${typeName}Result =`,
      `  | { variant: 'ok'; value: ${typeName} }`,
      `  | { variant: 'notFound'; id: string }`,
      `  | { variant: 'error'; message: string };`,
    ].join('\n');

    const clientFile = [
      `// Generated client for ${typeName} SDK`,
      `import type {`,
      `  ${typeName},`,
      `  Create${typeName}Input,`,
      `  Update${typeName}Input,`,
      `  ${typeName}Result,`,
      `} from './types';`,
      ``,
      `export interface ${typeName}ClientOptions {`,
      `  baseUrl: string;`,
      `  apiKey?: string;`,
      `  timeout?: number;`,
      `}`,
      ``,
      `export class ${typeName}Client {`,
      `  private baseUrl: string;`,
      `  private apiKey?: string;`,
      `  private timeout: number;`,
      ``,
      `  constructor(options: ${typeName}ClientOptions) {`,
      `    this.baseUrl = options.baseUrl;`,
      `    this.apiKey = options.apiKey;`,
      `    this.timeout = options.timeout ?? 30000;`,
      `  }`,
      ``,
      `  private async request<T>(path: string, init?: RequestInit): Promise<T> {`,
      `    const headers: Record<string, string> = {`,
      `      'Content-Type': 'application/json',`,
      `    };`,
      `    if (this.apiKey) {`,
      `      headers['Authorization'] = \`Bearer \${this.apiKey}\`;`,
      `    }`,
      `    const response = await fetch(\`\${this.baseUrl}\${path}\`, {`,
      `      ...init,`,
      `      headers: { ...headers, ...init?.headers as Record<string, string> },`,
      `      signal: AbortSignal.timeout(this.timeout),`,
      `    });`,
      `    if (!response.ok) {`,
      `      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);`,
      `    }`,
      `    return response.json() as Promise<T>;`,
      `  }`,
      ``,
      `  /** Create a new ${typeName}. */`,
      `  async create(input: Create${typeName}Input): Promise<${typeName}Result> {`,
      `    try {`,
      `      const value = await this.request<${typeName}>('/${conceptName}', {`,
      `        method: 'POST',`,
      `        body: JSON.stringify(input),`,
      `      });`,
      `      return { variant: 'ok', value };`,
      `    } catch (error) {`,
      `      return { variant: 'error', message: String(error) };`,
      `    }`,
      `  }`,
      ``,
      `  /** Get a ${typeName} by ID. */`,
      `  async get(id: string): Promise<${typeName}Result> {`,
      `    try {`,
      `      const value = await this.request<${typeName}>(\`/${conceptName}/\${id}\`);`,
      `      return { variant: 'ok', value };`,
      `    } catch (error) {`,
      `      return { variant: 'error', message: String(error) };`,
      `    }`,
      `  }`,
      ``,
      `  /** List all ${typeName} entries. */`,
      `  async list(): Promise<${typeName}[]> {`,
      `    return this.request<${typeName}[]>('/${conceptName}');`,
      `  }`,
      ``,
      `  /** Update a ${typeName}. */`,
      `  async update(id: string, input: Update${typeName}Input): Promise<${typeName}Result> {`,
      `    try {`,
      `      const value = await this.request<${typeName}>(\`/${conceptName}/\${id}\`, {`,
      `        method: 'PUT',`,
      `        body: JSON.stringify(input),`,
      `      });`,
      `      return { variant: 'ok', value };`,
      `    } catch (error) {`,
      `      return { variant: 'error', message: String(error) };`,
      `    }`,
      `  }`,
      ``,
      `  /** Delete a ${typeName}. */`,
      `  async delete(id: string): Promise<void> {`,
      `    await this.request<void>(\`/${conceptName}/\${id}\`, { method: 'DELETE' });`,
      `  }`,
      `}`,
    ].join('\n');

    const indexFile = [
      `// ${packageName} - Generated TypeScript SDK`,
      `export { ${typeName}Client } from './client';`,
      `export type {`,
      `  ${typeName},`,
      `  Create${typeName}Input,`,
      `  Update${typeName}Input,`,
      `  ${typeName}Result,`,
      `} from './types';`,
    ].join('\n');

    const moduleType = moduleSystem === 'esm' ? 'module' : 'commonjs';

    const packageJsonFile = [
      `{`,
      `  "name": "${packageName}",`,
      `  "version": "1.0.0",`,
      `  "description": "Generated TypeScript SDK for ${typeName}",`,
      `  "type": "${moduleType}",`,
      `  "main": "./dist/index.js",`,
      `  "types": "./dist/index.d.ts",`,
      `  "exports": {`,
      `    ".": {`,
      `      "types": "./dist/index.d.ts",`,
      `      "import": "./dist/index.js",`,
      `      "require": "./dist/index.cjs"`,
      `    }`,
      `  },`,
      `  "scripts": {`,
      `    "build": "tsup src/index.ts --format esm,cjs --dts",`,
      `    "test": "vitest run"`,
      `  },`,
      `  "dependencies": {},`,
      `  "devDependencies": {`,
      `    "tsup": "^8.0.0",`,
      `    "typescript": "^5.3.0",`,
      `    "vitest": "^1.0.0"`,
      `  }`,
      `}`,
    ].join('\n');

    const tsconfigFile = [
      `{`,
      `  "compilerOptions": {`,
      `    "target": "ES2022",`,
      `    "module": "${moduleSystem === 'esm' ? 'ESNext' : 'CommonJS'}",`,
      `    "moduleResolution": "${moduleSystem === 'esm' ? 'bundler' : 'node'}",`,
      `    "declaration": true,`,
      `    "strict": true,`,
      `    "outDir": "./dist",`,
      `    "rootDir": "./src"`,
      `  },`,
      `  "include": ["src/**/*"]`,
      `}`,
    ].join('\n');

    const files = [
      `src/index.ts`,
      `src/client.ts`,
      `src/types.ts`,
      `package.json`,
      `tsconfig.json`,
    ];

    const packageId = `ts-sdk-${conceptName}-${Date.now()}`;

    await storage.put('package', packageId, {
      packageId,
      packageName,
      runtime,
      moduleSystem,
      projection,
      config,
      files: JSON.stringify(files),
      typesFile,
      clientFile,
      indexFile,
      packageJsonFile,
      tsconfigFile,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      package: packageId,
      files,
    };
  },
};
