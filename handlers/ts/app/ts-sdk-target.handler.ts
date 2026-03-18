// @migrated dsl-constructs 2026-03-18
// TsSdkTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const tsSdkTargetHandlerFunctional: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;
    const parsedConfig = JSON.parse(config || '{}');
    const packageName = (parsedConfig.packageName as string) || '@clef/sdk';
    const runtime = (parsedConfig.runtime as string) || 'node';
    const moduleSystem = (parsedConfig.moduleSystem as string) || 'esm';
    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const typeName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    // Generate file contents (same as original)
    const typesFile = `// Generated types for ${typeName} SDK\n\nexport interface ${typeName} {\n  id: string;\n  name: string;\n  createdAt: string;\n  updatedAt: string;\n}\n\nexport interface Create${typeName}Input {\n  name: string;\n}\n\nexport interface Update${typeName}Input {\n  name?: string;\n}\n\nexport type ${typeName}Result =\n  | { variant: 'ok'; value: ${typeName} }\n  | { variant: 'notFound'; id: string }\n  | { variant: 'error'; message: string };`;
    const clientFile = `// Generated client for ${typeName} SDK`;
    const indexFile = `// ${packageName} - Generated TypeScript SDK\nexport { ${typeName}Client } from './client';\nexport type { ${typeName}, Create${typeName}Input, Update${typeName}Input, ${typeName}Result } from './types';`;
    const moduleType = moduleSystem === 'esm' ? 'module' : 'commonjs';
    const packageJsonFile = `{\n  "name": "${packageName}",\n  "version": "1.0.0",\n  "type": "${moduleType}"\n}`;
    const tsconfigFile = `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "strict": true\n  }\n}`;

    const files = ['src/index.ts', 'src/client.ts', 'src/types.ts', 'package.json', 'tsconfig.json'];
    const packageId = `ts-sdk-${conceptName}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'package', packageId, { packageId, packageName, runtime, moduleSystem, projection, config, files: JSON.stringify(files), typesFile, clientFile, indexFile, packageJsonFile, tsconfigFile, generatedAt: new Date().toISOString() });
    return complete(p, 'ok', { package: packageId, files }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const tsSdkTargetHandler = wrapFunctional(tsSdkTargetHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { tsSdkTargetHandlerFunctional };
