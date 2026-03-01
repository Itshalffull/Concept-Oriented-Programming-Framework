// TsSdkTarget — handler.ts
// TypeScript SDK client generation from concept projections.
// Produces typed API clients, request/response interfaces, and error handling utilities.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TsSdkTargetStorage,
  TsSdkTargetGenerateInput,
  TsSdkTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface TsSdkTargetError {
  readonly code: string;
  readonly message: string;
}

export interface TsSdkTargetHandler {
  readonly generate: (
    input: TsSdkTargetGenerateInput,
    storage: TsSdkTargetStorage,
  ) => TE.TaskEither<TsSdkTargetError, TsSdkTargetGenerateOutput>;
}

const toError = (error: unknown): TsSdkTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Parse a projection JSON string into a structured record, returning an Option.
const parseProjection = (raw: string): O.Option<Record<string, unknown>> => {
  try {
    return O.some(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return O.none;
  }
};

// Extract actions array from a parsed projection, defaulting to empty.
const extractActions = (proj: Record<string, unknown>): readonly Record<string, unknown>[] =>
  Array.isArray(proj['actions']) ? (proj['actions'] as readonly Record<string, unknown>[]) : [];

// Extract the concept name from a projection, defaulting to 'Unknown'.
const extractConceptName = (proj: Record<string, unknown>): string =>
  typeof proj['name'] === 'string' ? (proj['name'] as string) : 'Unknown';

// Map a Clef type annotation to a TypeScript type string.
const mapToTsType = (clefType: unknown): string => {
  if (typeof clefType !== 'string') return 'unknown';
  switch (clefType) {
    case 'string': return 'string';
    case 'int': case 'integer': case 'float': case 'number': return 'number';
    case 'bool': case 'boolean': return 'boolean';
    case 'void': return 'void';
    case 'date': return 'Date';
    default: return clefType.endsWith('[]') ? `readonly ${mapToTsType(clefType.slice(0, -2))}[]` : clefType;
  }
};

// Build a TypeScript interface definition from a set of fields.
const buildInterface = (name: string, fields: readonly Record<string, unknown>[]): string => {
  const lines = fields.map((f) => {
    const fieldName = String(f['name'] ?? 'unknown');
    const fieldType = mapToTsType(f['type']);
    const optional = f['optional'] === true ? '?' : '';
    return `  readonly ${fieldName}${optional}: ${fieldType};`;
  });
  return `export interface ${name} {\n${lines.join('\n')}\n}`;
};

// Build a typed client method for a single action.
const buildClientMethod = (action: Record<string, unknown>, conceptName: string): string => {
  const actionName = String(action['name'] ?? 'unknown');
  const inputs = Array.isArray(action['inputs']) ? (action['inputs'] as readonly Record<string, unknown>[]) : [];
  const outputType = typeof action['outputType'] === 'string' ? mapToTsType(action['outputType']) : 'void';

  const params = inputs
    .map((inp) => `${String(inp['name'] ?? 'arg')}: ${mapToTsType(inp['type'])}`)
    .join(', ');

  return [
    `  readonly ${actionName}: (${params}) => Promise<${outputType}>;`,
  ].join('\n');
};

// --- Implementation ---

export const tsSdkTargetHandler: TsSdkTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ts_sdk_config', input.config),
        toError,
      ),
      TE.chain((existingConfig) => {
        const config = pipe(
          O.fromNullable(existingConfig),
          O.getOrElse((): Record<string, unknown> => ({
            baseUrl: '/api',
            errorStrategy: 'throw',
          })),
        );

        return pipe(
          parseProjection(input.projection),
          O.fold(
            () => TE.left<TsSdkTargetError, TsSdkTargetGenerateOutput>({
              code: 'INVALID_PROJECTION',
              message: 'Failed to parse projection JSON for TypeScript SDK generation',
            }),
            (projection) => {
              const conceptName = extractConceptName(projection);
              const actions = extractActions(projection);
              const pascalName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);
              const packageName = `@clef/sdk-${conceptName.toLowerCase()}`;
              const baseUrl = typeof config['baseUrl'] === 'string' ? (config['baseUrl'] as string) : '/api';

              // Build request/response interfaces for each action
              const interfaceFiles: string[] = [];
              const actionInterfaces: string[] = [];
              for (const action of actions) {
                const actionName = String(action['name'] ?? 'unknown');
                const actionPascal = actionName.charAt(0).toUpperCase() + actionName.slice(1);
                const inputs = Array.isArray(action['inputs']) ? (action['inputs'] as readonly Record<string, unknown>[]) : [];
                const outputs = Array.isArray(action['outputs']) ? (action['outputs'] as readonly Record<string, unknown>[]) : [];

                if (inputs.length > 0) {
                  actionInterfaces.push(buildInterface(`${pascalName}${actionPascal}Request`, inputs));
                }
                if (outputs.length > 0) {
                  actionInterfaces.push(buildInterface(`${pascalName}${actionPascal}Response`, outputs));
                }
              }

              // Build the client interface with typed methods
              const clientMethods = actions.map((a) => buildClientMethod(a, conceptName));
              const clientInterface = [
                `export interface ${pascalName}Client {`,
                ...clientMethods,
                `}`,
              ].join('\n');

              // Build the client factory function
              const factoryFn = [
                `export const create${pascalName}Client = (baseUrl: string = '${baseUrl}'): ${pascalName}Client => ({`,
                ...actions.map((action) => {
                  const actionName = String(action['name'] ?? 'unknown');
                  const inputs = Array.isArray(action['inputs']) ? (action['inputs'] as readonly Record<string, unknown>[]) : [];
                  const params = inputs.map((inp) => String(inp['name'] ?? 'arg')).join(', ');
                  return `  ${actionName}: async (${params ? params : ''}) => {\n    const response = await fetch(\`\${baseUrl}/${conceptName.toLowerCase()}/${actionName}\`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ ${params} }),\n    });\n    if (!response.ok) throw new ${pascalName}ApiError(response.status, await response.text());\n    return response.json();\n  },`;
                }),
                `});`,
              ].join('\n');

              // Build the error class
              const errorClass = [
                `export class ${pascalName}ApiError extends Error {`,
                `  constructor(readonly statusCode: number, readonly body: string) {`,
                `    super(\`${pascalName} API error \${statusCode}: \${body}\`);`,
                `  }`,
                `}`,
              ].join('\n');

              const typesContent = [...actionInterfaces, clientInterface].join('\n\n');
              const clientContent = [errorClass, '', factoryFn].join('\n');
              const indexContent = `export * from './types';\nexport * from './client';`;

              const generatedFiles = [
                `${conceptName}/types.ts`,
                `${conceptName}/client.ts`,
                `${conceptName}/index.ts`,
              ];

              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('ts_sdk_artifact', conceptName, {
                      conceptName,
                      packageName,
                      files: generatedFiles,
                      typesContent,
                      clientContent,
                      indexContent,
                      generatedAt: new Date().toISOString(),
                    });
                    return generateOk(packageName, generatedFiles);
                  },
                  toError,
                ),
              );
            },
          ),
        );
      }),
    ),
};
