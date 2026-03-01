// Template — handler.ts
// Reusable content structures with dynamic variable substitution
// and conditional triggers for instantiation.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TemplateStorage,
  TemplateDefineInput,
  TemplateDefineOutput,
  TemplateInstantiateInput,
  TemplateInstantiateOutput,
  TemplateRegisterTriggerInput,
  TemplateRegisterTriggerOutput,
  TemplateMergePropertiesInput,
  TemplateMergePropertiesOutput,
} from './types.js';

import {
  defineOk,
  defineExists,
  instantiateOk,
  instantiateNotfound,
  registerTriggerOk,
  registerTriggerNotfound,
  mergePropertiesOk,
  mergePropertiesNotfound,
} from './types.js';

export interface TemplateError {
  readonly code: string;
  readonly message: string;
}

export interface TemplateHandler {
  readonly define: (
    input: TemplateDefineInput,
    storage: TemplateStorage,
  ) => TE.TaskEither<TemplateError, TemplateDefineOutput>;
  readonly instantiate: (
    input: TemplateInstantiateInput,
    storage: TemplateStorage,
  ) => TE.TaskEither<TemplateError, TemplateInstantiateOutput>;
  readonly registerTrigger: (
    input: TemplateRegisterTriggerInput,
    storage: TemplateStorage,
  ) => TE.TaskEither<TemplateError, TemplateRegisterTriggerOutput>;
  readonly mergeProperties: (
    input: TemplateMergePropertiesInput,
    storage: TemplateStorage,
  ) => TE.TaskEither<TemplateError, TemplateMergePropertiesOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): TemplateError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

// Parse comma-separated variable declarations: "name,title,date"
const parseVariableNames = (variables: string): readonly string[] =>
  variables.split(',').map((v) => v.trim()).filter((v) => v.length > 0);

// Parse key=value pairs: "name=World,title=Hello"
const parseValues = (values: string): ReadonlyMap<string, string> => {
  const map = new Map<string, string>();
  const pairs = values.split(',');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      const key = pair.substring(0, eqIndex).trim();
      const val = pair.substring(eqIndex + 1).trim();
      map.set(key, val);
    }
  }
  return map;
};

// Substitute {{variable}} placeholders in the template body with values.
// Uses double-curly-brace syntax: {{name}}, {{title}}, etc.
const substituteVariables = (
  body: string,
  values: ReadonlyMap<string, string>,
): string => {
  let result = body;
  for (const [key, val] of values) {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, val);
  }
  return result;
};

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Validate that all required variables have values provided
const findMissingVariables = (
  required: readonly string[],
  provided: ReadonlyMap<string, string>,
): readonly string[] =>
  required.filter((v) => !provided.has(v));

const parseTriggers = (raw: unknown): readonly string[] => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return raw.length > 0 ? [raw] : [];
    }
  }
  if (Array.isArray(raw)) {
    return raw as string[];
  }
  return [];
};

// --- Implementation ---

export const templateHandler: TemplateHandler = {
  // Registers a new template with its body and variable declarations.
  // Checks for existing template with the same identity.
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('template', input.template),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const variables = parseVariableNames(input.variables);
                  const record: Record<string, unknown> = {
                    id: input.template,
                    body: input.body,
                    variables: JSON.stringify(variables),
                    triggers: JSON.stringify([]),
                    properties: JSON.stringify({}),
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  };
                  await storage.put('template', input.template, record);
                  return defineOk();
                },
                storageError,
              ),
            () =>
              TE.right<TemplateError, TemplateDefineOutput>(
                defineExists(`Template ${input.template} already exists`),
              ),
          ),
        ),
      ),
    ),

  // Produces concrete content by substituting variables into the template body.
  // Validates all declared variables have corresponding values.
  instantiate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('template', input.template),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<TemplateError, TemplateInstantiateOutput>(
              instantiateNotfound(`Template ${input.template} does not exist`),
            ),
            (tmpl) => {
              const body = typeof tmpl.body === 'string' ? tmpl.body : '';
              const declaredVarsRaw = typeof tmpl.variables === 'string'
                ? tmpl.variables
                : '[]';

              let declaredVars: readonly string[];
              try {
                declaredVars = JSON.parse(declaredVarsRaw) as string[];
              } catch {
                declaredVars = [];
              }

              const values = parseValues(input.values);
              const missing = findMissingVariables(declaredVars, values);

              if (missing.length > 0) {
                return TE.left<TemplateError>({
                  code: 'MISSING_VARIABLES',
                  message: `Missing required variables: ${missing.join(', ')}`,
                });
              }

              const content = substituteVariables(body, values);
              return TE.right<TemplateError, TemplateInstantiateOutput>(
                instantiateOk(content),
              );
            },
          ),
        ),
      ),
    ),

  // Attaches a conditional trigger that auto-instantiates the template.
  // Appends to existing trigger list.
  registerTrigger: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('template', input.template),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<TemplateError, TemplateRegisterTriggerOutput>(
              registerTriggerNotfound(`Template ${input.template} does not exist`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const triggers = parseTriggers(existing.triggers);
                  const updatedTriggers = [...triggers, input.trigger];
                  const updated = {
                    ...existing,
                    triggers: JSON.stringify(updatedTriggers),
                    updatedAt: nowISO(),
                  };
                  await storage.put('template', input.template, updated);
                  return registerTriggerOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Merges additional properties into an existing template definition.
  // Properties are parsed as key=value pairs and merged with existing ones.
  mergeProperties: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('template', input.template),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<TemplateError, TemplateMergePropertiesOutput>(
              mergePropertiesNotfound(`Template ${input.template} does not exist`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  let existingProps: Record<string, string> = {};
                  if (typeof existing.properties === 'string') {
                    try {
                      existingProps = JSON.parse(existing.properties) as Record<string, string>;
                    } catch {
                      existingProps = {};
                    }
                  }

                  // Parse incoming properties as key=value pairs
                  const newProps = parseValues(input.properties);
                  const mergedProps = { ...existingProps };
                  for (const [key, val] of newProps) {
                    mergedProps[key] = val;
                  }

                  const updated = {
                    ...existing,
                    properties: JSON.stringify(mergedProps),
                    updatedAt: nowISO(),
                  };
                  await storage.put('template', input.template, updated);
                  return mergePropertiesOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
