// EnrichmentRenderer — Content enrichment and rendering pipeline
// Registers pattern-based enrichment handlers, resolves embedded references
// and annotations within content, and renders display-ready output.
// Supports multiple output formats and ordered handler execution.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EnrichmentRendererStorage,
  EnrichmentRendererRegisterInput,
  EnrichmentRendererRegisterOutput,
  EnrichmentRendererRenderInput,
  EnrichmentRendererRenderOutput,
  EnrichmentRendererListHandlersInput,
  EnrichmentRendererListHandlersOutput,
  EnrichmentRendererListPatternsInput,
  EnrichmentRendererListPatternsOutput,
} from './types.js';

import {
  registerOk,
  registerUnknownPattern,
  registerInvalidTemplate,
  renderOk,
  renderInvalidContent,
  renderUnknownFormat,
  listHandlersOk,
  listPatternsOk,
} from './types.js';

export interface EnrichmentRendererError {
  readonly code: string;
  readonly message: string;
}

export interface EnrichmentRendererHandler {
  readonly register: (
    input: EnrichmentRendererRegisterInput,
    storage: EnrichmentRendererStorage,
  ) => TE.TaskEither<EnrichmentRendererError, EnrichmentRendererRegisterOutput>;
  readonly render: (
    input: EnrichmentRendererRenderInput,
    storage: EnrichmentRendererStorage,
  ) => TE.TaskEither<EnrichmentRendererError, EnrichmentRendererRenderOutput>;
  readonly listHandlers: (
    input: EnrichmentRendererListHandlersInput,
    storage: EnrichmentRendererStorage,
  ) => TE.TaskEither<EnrichmentRendererError, EnrichmentRendererListHandlersOutput>;
  readonly listPatterns: (
    input: EnrichmentRendererListPatternsInput,
    storage: EnrichmentRendererStorage,
  ) => TE.TaskEither<EnrichmentRendererError, EnrichmentRendererListPatternsOutput>;
}

const storageError = (error: unknown): EnrichmentRendererError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Known enrichment patterns that can be registered
const KNOWN_PATTERNS: readonly string[] = [
  'inline-ref',
  'block-ref',
  'annotation',
  'embed',
  'link',
  'mention',
  'tag-ref',
  'code-block',
  'math',
  'callout',
];

// Supported output formats
const SUPPORTED_FORMATS: readonly string[] = ['html', 'markdown', 'plaintext', 'json'];

// Validate a template string for basic structural correctness
const isValidTemplate = (template: string): { readonly valid: boolean; readonly reason: string } => {
  if (!template || template.trim().length === 0) {
    return { valid: false, reason: 'Template must be non-empty' };
  }

  // Check for unbalanced template delimiters
  const openCount = (template.match(/\{\{/g) || []).length;
  const closeCount = (template.match(/\}\}/g) || []).length;
  if (openCount !== closeCount) {
    return { valid: false, reason: `Unbalanced template delimiters: ${openCount} opening vs ${closeCount} closing` };
  }

  return { valid: true, reason: '' };
};

// --- Implementation ---

export const enrichmentRendererHandler: EnrichmentRendererHandler = {
  // Register an enrichment handler for a specific pattern and format.
  // Validates that the pattern is known and the template is well-formed.
  register: (input, storage) => {
    // Validate the pattern
    if (!KNOWN_PATTERNS.includes(input.pattern)) {
      return TE.right(registerUnknownPattern(input.pattern));
    }

    // Validate the template
    const templateCheck = isValidTemplate(input.template);
    if (!templateCheck.valid) {
      return TE.right(registerInvalidTemplate(input.template, templateCheck.reason));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const handlerId = `${input.pattern}::${input.format}::${input.key}`;
          const now = new Date().toISOString();

          await storage.put('enrichment_handlers', input.key, {
            key: input.key,
            format: input.format,
            order: input.order,
            pattern: input.pattern,
            template: input.template,
            handlerId,
            registeredAt: now,
          });

          // Also index by pattern for fast lookup during rendering
          await storage.put(
            'enrichment_pattern_index',
            `${input.format}::${input.pattern}::${input.order}`,
            {
              key: input.key,
              handlerId,
              order: input.order,
            },
          );

          return registerOk(handlerId);
        },
        storageError,
      ),
    );
  },

  // Render content by applying all registered enrichment handlers for
  // the specified format. Processes content sections sequentially in
  // handler order, collecting any unhandled enrichment keys.
  render: (input, storage) => {
    if (!input.content || input.content.trim().length === 0) {
      return TE.right(renderInvalidContent('Content must be non-empty'));
    }

    if (!SUPPORTED_FORMATS.includes(input.format)) {
      return TE.right(renderUnknownFormat(input.format));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          // Retrieve all handlers registered for this format
          const allHandlers = await storage.find('enrichment_handlers', { format: input.format });

          // Sort handlers by order
          const sortedHandlers = [...allHandlers].sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 0;
            const orderB = typeof b.order === 'number' ? b.order : 0;
            return orderA - orderB;
          });

          let output = input.content;
          let sectionCount = 0;
          const handledPatterns = new Set<string>();
          const unhandledKeys: string[] = [];

          // Apply each handler to the content
          for (const handler of sortedHandlers) {
            const pattern = String(handler.pattern ?? '');
            const template = String(handler.template ?? '');
            const key = String(handler.key ?? '');

            // Build a regex-like pattern marker for this enrichment type
            // e.g., [[inline-ref:...]] or {{embed:...}}
            const markerOpen = pattern.includes('ref') ? '[[' : '{{';
            const markerClose = pattern.includes('ref') ? ']]' : '}}';
            const patternMarker = `${markerOpen}${pattern}:`;

            if (output.includes(patternMarker)) {
              // Replace pattern markers with rendered template output
              const regex = new RegExp(
                `${markerOpen.replace(/[[\]{}]/g, '\\$&')}${pattern}:([^${markerClose[0]}]+)${markerClose.replace(/[[\]{}]/g, '\\$&')}`,
                'g',
              );
              output = output.replace(regex, (_match, content) => {
                sectionCount += 1;
                return template.replace(/\{\{content\}\}/g, content);
              });
              handledPatterns.add(pattern);
            }
          }

          // Detect any remaining unhandled enrichment markers in the output
          const unmatchedRefPattern = /\[\[(\w[\w-]*):([^\]]+)\]\]/g;
          const unmatchedEmbedPattern = /\{\{(\w[\w-]*):([^}]+)\}\}/g;

          let match: RegExpExecArray | null;
          while ((match = unmatchedRefPattern.exec(output)) !== null) {
            if (!handledPatterns.has(match[1])) {
              unhandledKeys.push(match[1]);
            }
          }
          while ((match = unmatchedEmbedPattern.exec(output)) !== null) {
            if (!handledPatterns.has(match[1])) {
              unhandledKeys.push(match[1]);
            }
          }

          // Deduplicate unhandled keys
          const uniqueUnhandled = [...new Set(unhandledKeys)];

          return renderOk(output, sectionCount, uniqueUnhandled);
        },
        storageError,
      ),
    );
  },

  // List all registered handlers for a given format, sorted by order.
  listHandlers: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allHandlers = await storage.find('enrichment_handlers', { format: input.format });

          const sorted = [...allHandlers].sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 0;
            const orderB = typeof b.order === 'number' ? b.order : 0;
            return orderA - orderB;
          });

          const handlerIds = sorted.map((h) => String(h.handlerId ?? h.key ?? ''));

          return listHandlersOk(handlerIds, handlerIds.length);
        },
        storageError,
      ),
    ),

  // List all known enrichment patterns, both built-in and any custom-registered.
  listPatterns: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Start with built-in patterns
          const patterns = new Set<string>(KNOWN_PATTERNS);

          // Add any custom patterns found in registrations
          const allHandlers = await storage.find('enrichment_handlers');
          for (const handler of allHandlers) {
            const pattern = String(handler.pattern ?? '');
            if (pattern.length > 0) {
              patterns.add(pattern);
            }
          }

          return listPatternsOk([...patterns].sort());
        },
        storageError,
      ),
    ),
};
