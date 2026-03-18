// @migrated dsl-constructs 2026-03-18
// Spec Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

/** Known specification formats and their validators. */
const KNOWN_FORMATS = ['openapi', 'asyncapi', 'jsonschema', 'graphql-schema', 'protobuf'];

const _specHandler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    const projections = JSON.parse(input.projections as string) as string[];
    const format = input.format as string;
    const config = input.config as string;

    let configData: Record<string, unknown>;
    try {
      configData = JSON.parse(config);
    } catch {
      configData = {};
    }

    if (!KNOWN_FORMATS.includes(format)) {
      let p = createProgram();
      return complete(p, 'formatError', {
        format,
        reason: `Unknown specification format: "${format}". Supported: ${KNOWN_FORMATS.join(', ')}`,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const suiteName = (configData.kit as string) ?? 'default';
    const version = (configData.version as string) ?? '1.0.0';

    let content = '';
    if (format === 'openapi') {
      const paths: Record<string, unknown> = {};
      for (const proj of projections) {
        paths[`/${proj}`] = {
          get: { summary: `List ${proj}`, operationId: `list_${proj}` },
          post: { summary: `Create ${proj}`, operationId: `create_${proj}` },
        };
      }
      content = JSON.stringify({ openapi: '3.0.3', info: { title: `${suiteName} API`, version }, paths }, null, 2);
    } else if (format === 'asyncapi') {
      const channels: Record<string, unknown> = {};
      for (const proj of projections) {
        channels[proj] = { subscribe: { summary: `${proj} events` } };
      }
      content = JSON.stringify({ asyncapi: '2.6.0', info: { title: `${suiteName} Events`, version }, channels }, null, 2);
    } else if (format === 'jsonschema') {
      const properties: Record<string, unknown> = {};
      for (const proj of projections) {
        properties[proj] = { type: 'object' };
      }
      content = JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', title: suiteName, type: 'object', properties }, null, 2);
    } else if (format === 'graphql-schema') {
      const types = projections.map((p) => `type ${p} {\n  id: ID!\n}`);
      content = types.join('\n\n');
    } else if (format === 'protobuf') {
      const messages = projections.map((p) => `message ${p} {\n  string id = 1;\n}`);
      content = `syntax = "proto3";\n\npackage ${suiteName};\n\n${messages.join('\n\n')}`;
    }

    const documentId = `spec-${format}-${suiteName}-${Date.now()}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'document', documentId, { documentId, format, suiteName, version, generatedAt: now, content });
    return complete(p, 'ok', { document: documentId, content }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const document = input.document as string;

    let p = createProgram();
    p = spGet(p, 'document', document, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const format = existing.format as string;
          const content = existing.content as string;
          const errors: string[] = [];

          if (format === 'openapi' || format === 'asyncapi' || format === 'jsonschema') {
            try {
              const parsed = JSON.parse(content);
              if (format === 'openapi' && !parsed.openapi) errors.push('Missing required "openapi" version field');
              if (format === 'openapi' && !parsed.info) errors.push('Missing required "info" field');
              if (format === 'asyncapi' && !parsed.asyncapi) errors.push('Missing required "asyncapi" version field');
              if (format === 'jsonschema' && !parsed.$schema) errors.push('Missing required "$schema" field');
            } catch {
              errors.push('Invalid JSON structure');
            }
          } else if (format === 'protobuf') {
            if (!content.includes('syntax')) errors.push('Missing syntax declaration');
          }
          return errors;
        }, 'errors');
        b2 = branch(b2, (bindings) => (bindings.errors as string[]).length > 0,
          (() => {
            let e = createProgram();
            return complete(e, 'invalid', { document, errors: '' });
          })(),
          (() => {
            let ok = createProgram();
            return complete(ok, 'ok', { document });
          })(),
        );
        return b2;
      },
      (b) => complete(b, 'invalid', { document, errors: JSON.stringify(['Document not found']) }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const specHandler = autoInterpret(_specHandler);

