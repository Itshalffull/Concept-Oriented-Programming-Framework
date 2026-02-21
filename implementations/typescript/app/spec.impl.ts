// Spec Concept Implementation (Interface Kit)
import type { ConceptHandler } from '@copf/kernel';

/** Known specification formats and their validators. */
const KNOWN_FORMATS = ['openapi', 'asyncapi', 'jsonschema', 'graphql-schema', 'protobuf'];

export const specHandler: ConceptHandler = {
  async emit(input, storage) {
    const projections = JSON.parse(input.projections as string) as string[];
    const format = input.format as string;
    const config = input.config as string;

    // Parse config
    let configData: Record<string, unknown>;
    try {
      configData = JSON.parse(config);
    } catch {
      configData = {};
    }

    if (!KNOWN_FORMATS.includes(format)) {
      return {
        variant: 'formatError',
        format,
        reason: `Unknown specification format: "${format}". Supported: ${KNOWN_FORMATS.join(', ')}`,
      };
    }

    const kitName = (configData.kit as string) ?? 'default';
    const version = (configData.version as string) ?? '1.0.0';

    // Generate specification content based on format
    let content = '';

    if (format === 'openapi') {
      const paths: Record<string, unknown> = {};
      for (const proj of projections) {
        paths[`/${proj}`] = {
          get: { summary: `List ${proj}`, operationId: `list_${proj}` },
          post: { summary: `Create ${proj}`, operationId: `create_${proj}` },
        };
      }
      content = JSON.stringify({
        openapi: '3.0.3',
        info: { title: `${kitName} API`, version },
        paths,
      }, null, 2);
    } else if (format === 'asyncapi') {
      const channels: Record<string, unknown> = {};
      for (const proj of projections) {
        channels[proj] = {
          subscribe: { summary: `${proj} events` },
        };
      }
      content = JSON.stringify({
        asyncapi: '2.6.0',
        info: { title: `${kitName} Events`, version },
        channels,
      }, null, 2);
    } else if (format === 'jsonschema') {
      const properties: Record<string, unknown> = {};
      for (const proj of projections) {
        properties[proj] = { type: 'object' };
      }
      content = JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: kitName,
        type: 'object',
        properties,
      }, null, 2);
    } else if (format === 'graphql-schema') {
      const types = projections.map((p) => `type ${p} {\n  id: ID!\n}`);
      content = types.join('\n\n');
    } else if (format === 'protobuf') {
      const messages = projections.map(
        (p) => `message ${p} {\n  string id = 1;\n}`,
      );
      content = `syntax = "proto3";\n\npackage ${kitName};\n\n${messages.join('\n\n')}`;
    }

    const documentId = `spec-${format}-${kitName}-${Date.now()}`;
    const now = new Date().toISOString();

    await storage.put('document', documentId, {
      documentId,
      format,
      kitName,
      version,
      generatedAt: now,
      content,
    });

    return { variant: 'ok', document: documentId, content };
  },

  async validate(input, storage) {
    const document = input.document as string;

    const existing = await storage.get('document', document);
    if (!existing) {
      return {
        variant: 'invalid',
        document,
        errors: JSON.stringify(['Document not found']),
      };
    }

    const format = existing.format as string;
    const content = existing.content as string;
    const errors: string[] = [];

    // Format-specific validation
    if (format === 'openapi' || format === 'asyncapi' || format === 'jsonschema') {
      // Validate JSON structure
      try {
        const parsed = JSON.parse(content);
        if (format === 'openapi' && !parsed.openapi) {
          errors.push('Missing required "openapi" version field');
        }
        if (format === 'openapi' && !parsed.info) {
          errors.push('Missing required "info" field');
        }
        if (format === 'asyncapi' && !parsed.asyncapi) {
          errors.push('Missing required "asyncapi" version field');
        }
        if (format === 'jsonschema' && !parsed.$schema) {
          errors.push('Missing required "$schema" field');
        }
      } catch {
        errors.push('Invalid JSON structure');
      }
    } else if (format === 'protobuf') {
      if (!content.includes('syntax')) {
        errors.push('Missing syntax declaration');
      }
    }

    if (errors.length > 0) {
      return { variant: 'invalid', document, errors: JSON.stringify(errors) };
    }

    return { variant: 'ok', document };
  },
};
