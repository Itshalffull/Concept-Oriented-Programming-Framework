// ConceptScaffoldGen — Concept spec file scaffold generator
// Produces .concept file content from name, type parameter, state fields, and actions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/ReadonlyArray';
import { pipe } from 'fp-ts/function';

import type {
  ConceptScaffoldGenStorage,
  ConceptScaffoldGenGenerateInput,
  ConceptScaffoldGenGenerateOutput,
  ConceptScaffoldGenPreviewInput,
  ConceptScaffoldGenPreviewOutput,
  ConceptScaffoldGenRegisterInput,
  ConceptScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface ConceptScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface ConceptScaffoldGenHandler {
  readonly generate: (
    input: ConceptScaffoldGenGenerateInput,
    storage: ConceptScaffoldGenStorage,
  ) => TE.TaskEither<ConceptScaffoldGenError, ConceptScaffoldGenGenerateOutput>;
  readonly preview: (
    input: ConceptScaffoldGenPreviewInput,
    storage: ConceptScaffoldGenStorage,
  ) => TE.TaskEither<ConceptScaffoldGenError, ConceptScaffoldGenPreviewOutput>;
  readonly register: (
    input: ConceptScaffoldGenRegisterInput,
    storage: ConceptScaffoldGenStorage,
  ) => TE.TaskEither<ConceptScaffoldGenError, ConceptScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const toPascalCase = (s: string): string =>
  s.replace(/(^|[-_ ])(\w)/g, (_, _sep, c) => c.toUpperCase());

const toKebabCase = (s: string): string =>
  s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();

const renderStateField = (field: unknown): string => {
  const f = field as Record<string, unknown>;
  const name = String(f.name ?? 'unknown');
  const fieldType = String(f.type ?? 'String');
  return `  ${name}: ${fieldType}`;
};

const renderAction = (action: unknown): string => {
  const a = action as Record<string, unknown>;
  const name = String(a.name ?? 'unknown');
  const inputs = Array.isArray(a.inputs) ? a.inputs : [];
  const outputs = Array.isArray(a.outputs) ? a.outputs : [];
  const inputLines = inputs.map((i: unknown) => {
    const inp = i as Record<string, unknown>;
    return `    ${String(inp.name ?? 'param')}: ${String(inp.type ?? 'String')}`;
  });
  const outputLines = outputs.map((o: unknown) => {
    const out = o as Record<string, unknown>;
    return `    ${String(out.name ?? 'result')}: ${String(out.type ?? 'String')}`;
  });
  const inputBlock = inputLines.length > 0 ? `\n  input:\n${inputLines.join('\n')}` : '';
  const outputBlock = outputLines.length > 0 ? `\n  output:\n${outputLines.join('\n')}` : '';
  return `  action ${name}:${inputBlock}${outputBlock}`;
};

const buildConceptFileContent = (input: ConceptScaffoldGenGenerateInput): string => {
  const conceptName = toPascalCase(input.name);
  const typeParam = input.typeParam || 'T';
  const stateBlock = input.stateFields.length > 0
    ? `\nstate:\n${input.stateFields.map(renderStateField).join('\n')}\n`
    : '';
  const actionsBlock = input.actions.length > 0
    ? `\nactions:\n${input.actions.map(renderAction).join('\n\n')}\n`
    : '';

  return [
    `concept ${conceptName}<${typeParam}>:`,
    `  purpose: "${input.purpose}"`,
    stateBlock,
    actionsBlock,
  ].filter(Boolean).join('\n');
};

const buildGeneratedFiles = (input: ConceptScaffoldGenGenerateInput): readonly Record<string, unknown>[] => {
  const kebabName = toKebabCase(input.name);
  const conceptContent = buildConceptFileContent(input);
  return [
    { path: `${kebabName}/${kebabName}.concept`, content: conceptContent, kind: 'concept-spec' },
  ];
};

// --- Implementation ---

export const conceptScaffoldGenHandler: ConceptScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.fromEither<ConceptScaffoldGenError, ConceptScaffoldGenGenerateInput>(
        input.name.trim().length === 0
          ? { _tag: 'Left' as const, left: { code: 'INVALID_INPUT', message: 'Concept name must not be empty' } }
          : { _tag: 'Right' as const, right: input },
      ),
      TE.chain((validInput) =>
        pipe(
          TE.tryCatch(
            async () => {
              const files = buildGeneratedFiles(validInput);
              // Persist the generation record for idempotency checks
              await storage.put('concept_scaffolds', validInput.name, {
                name: validInput.name,
                typeParam: validInput.typeParam,
                purpose: validInput.purpose,
                stateFields: validInput.stateFields as unknown[],
                actions: validInput.actions as unknown[],
                generatedAt: new Date().toISOString(),
              });
              return generateOk(files, files.length);
            },
            (error): ConceptScaffoldGenError => ({
              code: 'STORAGE_ERROR',
              message: error instanceof Error ? error.message : String(error),
            }),
          ),
        ),
      ),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('concept_scaffolds', input.name),
        (error): ConceptScaffoldGenError => ({
          code: 'STORAGE_ERROR',
          message: error instanceof Error ? error.message : String(error),
        }),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            // No prior generation -- compute preview
            () => {
              const files = buildGeneratedFiles(input);
              return TE.right<ConceptScaffoldGenError, ConceptScaffoldGenPreviewOutput>(
                previewOk(files, files.length, 0),
              );
            },
            // Already generated -- return cached
            (_found) =>
              TE.right<ConceptScaffoldGenError, ConceptScaffoldGenPreviewOutput>(
                previewCached(),
              ),
          ),
        ),
      ),
    ),

  register: (_input, _storage) =>
    TE.right(
      registerOk(
        'concept-scaffold-gen',
        'ConceptScaffoldGenGenerateInput',
        'ConceptScaffoldGenGenerateOutput',
        ['generate', 'preview'],
      ),
    ),
};
