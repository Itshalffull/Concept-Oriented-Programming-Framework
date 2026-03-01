// Sdk — SDK generation from concept specifications.
// Takes a concept projection and target language, generates typed SDK packages
// with client stubs, type definitions, and package manifests. Supports publish
// to configured registries with version-conflict detection.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SdkStorage,
  SdkGenerateInput,
  SdkGenerateOutput,
  SdkPublishInput,
  SdkPublishOutput,
} from './types.js';

import {
  generateOk,
  generateUnsupportedType,
  generateLanguageError,
  publishOk,
  publishVersionExists,
  publishRegistryUnavailable,
} from './types.js';

export interface SdkError {
  readonly code: string;
  readonly message: string;
}

export interface SdkHandler {
  readonly generate: (
    input: SdkGenerateInput,
    storage: SdkStorage,
  ) => TE.TaskEither<SdkError, SdkGenerateOutput>;
  readonly publish: (
    input: SdkPublishInput,
    storage: SdkStorage,
  ) => TE.TaskEither<SdkError, SdkPublishOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): SdkError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Supported SDK target languages and their file extensions. */
const LANGUAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  typescript: 'ts',
  python: 'py',
  rust: 'rs',
  go: 'go',
  java: 'java',
  swift: 'swift',
};

/** Parse config JSON safely. */
const parseConfig = (config: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(config);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

/** Build the package name from projection and language. */
const makePackageName = (projection: string, language: string): string =>
  `@clef-sdk/${projection}-${language}`;

/** Generate the set of SDK files for the given language. */
const buildSdkFiles = (
  projection: string,
  language: string,
  ext: string,
): readonly string[] => [
  `src/client.${ext}`,
  `src/types.${ext}`,
  `src/index.${ext}`,
  `src/${projection}.${ext}`,
];

/** Generate a minimal package.json manifest for the SDK. */
const buildPackageJson = (
  packageName: string,
  language: string,
  version: string,
): string =>
  JSON.stringify(
    {
      name: packageName,
      version,
      language,
      main: language === 'typescript' ? 'dist/index.js' : `src/index.${LANGUAGE_EXTENSIONS[language] ?? 'txt'}`,
      types: language === 'typescript' ? 'dist/index.d.ts' : undefined,
    },
    null,
    2,
  );

// --- Implementation ---

export const sdkHandler: SdkHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { projection, language, config } = input;
          const ext = LANGUAGE_EXTENSIONS[language];

          // Validate the language is supported
          if (ext === undefined) {
            return generateLanguageError(
              language,
              `Unsupported language '${language}'. Supported: ${Object.keys(LANGUAGE_EXTENSIONS).join(', ')}`,
            );
          }

          const parsedConfig = parseConfig(config);

          // Check for unsupported type mappings (custom types that cannot be represented)
          const unsupportedTypes = (parsedConfig['customTypes'] as readonly string[]) ?? [];
          for (const typeName of unsupportedTypes) {
            // Types containing generics (angle brackets) are not yet supported
            if (typeName.includes('<') || typeName.includes('>')) {
              return generateUnsupportedType(typeName, language);
            }
          }

          const version = (parsedConfig['version'] as string) ?? '0.1.0';
          const packageName = makePackageName(projection, language);
          const files = buildSdkFiles(projection, language, ext);
          const packageJson = buildPackageJson(packageName, language, version);

          // Persist the generated SDK record
          await storage.put('packages', packageName, {
            packageName,
            projection,
            language,
            version,
            files: [...files],
            packageJson,
            generatedAt: new Date().toISOString(),
          });

          return generateOk(packageName, files, packageJson);
        },
        storageError,
      ),
    ),

  publish: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { registry } = input;
          const packageName = input.package;

          // Validate registry is a valid URL or known registry name
          const knownRegistries: ReadonlySet<string> = new Set(['npm', 'pypi', 'crates', 'maven', 'github']);
          const isKnownRegistry = knownRegistries.has(registry);
          const isUrl = registry.startsWith('http://') || registry.startsWith('https://');

          if (!isKnownRegistry && !isUrl) {
            return publishRegistryUnavailable(registry);
          }

          // Retrieve the package record to get the version
          const packageRecord = await storage.get('packages', packageName);

          return pipe(
            O.fromNullable(packageRecord),
            O.fold(
              // Package not found -- cannot publish something that was not generated
              () => publishRegistryUnavailable(registry),
              async (pkg) => {
                const version = (pkg['version'] as string) ?? '0.1.0';
                const publishKey = `${registry}:${packageName}:${version}`;

                // Check if this version was already published
                const existing = await storage.get('publications', publishKey);

                if (existing !== null) {
                  return publishVersionExists(packageName, version);
                }

                // Record the publication
                await storage.put('publications', publishKey, {
                  packageName,
                  registry,
                  version,
                  publishedAt: new Date().toISOString(),
                });

                return publishOk(packageName, version);
              },
            ),
          );
        },
        storageError,
      ),
    ),
};
