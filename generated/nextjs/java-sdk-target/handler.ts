// JavaSdkTarget — Generates Java API client libraries with builder pattern from concept projections.
// Produces Maven-compatible artifacts with typed request/response classes and fluent builders.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  JavaSdkTargetStorage,
  JavaSdkTargetGenerateInput,
  JavaSdkTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface JavaSdkTargetError {
  readonly code: string;
  readonly message: string;
}

export interface JavaSdkTargetHandler {
  readonly generate: (
    input: JavaSdkTargetGenerateInput,
    storage: JavaSdkTargetStorage,
  ) => TE.TaskEither<JavaSdkTargetError, JavaSdkTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): JavaSdkTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Default Maven group ID for generated clients. */
const DEFAULT_GROUP_ID = 'com.clef.sdk';

/** Parse a projection into concept metadata. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly string[];
  readonly fields: readonly { readonly name: string; readonly type: string }[];
  readonly groupId: string;
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly string[] | undefined) ?? ['create', 'get', 'list', 'update', 'delete'],
      fields: (parsed['fields'] as readonly { name: string; type: string }[] | undefined) ?? [],
      groupId: (parsed['groupId'] as string | undefined) ?? DEFAULT_GROUP_ID,
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: ['create', 'get', 'list', 'update', 'delete'] as readonly string[],
      fields: [] as readonly { readonly name: string; readonly type: string }[],
      groupId: DEFAULT_GROUP_ID,
    })),
  );

/** Convert concept name to a PascalCase Java class name. */
const toClassName = (concept: string): string =>
  concept.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Convert concept name to a kebab-case Maven artifact ID. */
const toArtifactId = (concept: string): string =>
  concept.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') + '-client';

/** Map a TypeScript-like type to its Java equivalent. */
const toJavaType = (tsType: string): string => {
  const mapping: Record<string, string> = {
    string: 'String',
    number: 'Double',
    integer: 'Integer',
    boolean: 'Boolean',
    object: 'Map<String, Object>',
    array: 'List<Object>',
    date: 'Instant',
  };
  return mapping[tsType.toLowerCase()] ?? 'String';
};

/** Convert an action name to a camelCase Java method name. */
const toMethodName = (action: string): string =>
  action.charAt(0).toLowerCase() + action.slice(1);

/** Build the Java package path from group ID and concept. */
const toPackagePath = (groupId: string, concept: string): string => {
  const conceptDir = concept.toLowerCase();
  return `${groupId.replace(/\./g, '/')}/${conceptDir}`;
};

// --- Implementation ---

export const javaSdkTargetHandler: JavaSdkTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions, fields, groupId } = parseProjection(input.projection);
          const className = toClassName(concept);
          const artifactId = toArtifactId(concept);
          const packagePath = toPackagePath(groupId, concept);
          const files: string[] = [];

          // Maven project structure
          files.push('pom.xml');

          // Client class with builder
          const clientFile = `src/main/java/${packagePath}/${className}Client.java`;
          files.push(clientFile);

          // Request/Response model classes
          const modelFile = `src/main/java/${packagePath}/model/${className}.java`;
          files.push(modelFile);

          // Builder class
          const builderFile = `src/main/java/${packagePath}/${className}ClientBuilder.java`;
          files.push(builderFile);

          // Exception class
          const exceptionFile = `src/main/java/${packagePath}/${className}ClientException.java`;
          files.push(exceptionFile);

          // Generate method metadata for each action
          const methods: string[] = [];
          for (const action of actions) {
            const methodName = toMethodName(action);
            methods.push(methodName);

            await storage.put('methods', `${artifactId}:${methodName}`, {
              concept,
              artifactId,
              className,
              methodName,
              action,
              returnType: `${className}Response`,
              requestType: `${className}${toClassName(action)}Request`,
            });
          }

          // Store field type mappings for model generation
          const javaFields = fields.map((f) => ({
            name: f.name,
            javaType: toJavaType(f.type),
          }));

          await storage.put('artifacts', artifactId, {
            concept,
            groupId,
            artifactId,
            className,
            methods: [...methods],
            fields: [...javaFields],
            files: [...files],
            dependencies: ['com.fasterxml.jackson.core:jackson-databind', 'org.apache.httpcomponents.client5:httpclient5'],
          });

          return generateOk(artifactId, files);
        },
        storageError,
      ),
    ),
};
