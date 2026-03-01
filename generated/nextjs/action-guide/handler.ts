// ActionGuide — Workflow documentation generator for concept action signatures.
// Extracts action signatures from concept definitions, assembles step-by-step
// guides, and renders them to markdown or plain-text formats.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ActionGuideStorage,
  ActionGuideDefineInput,
  ActionGuideDefineOutput,
  ActionGuideRenderInput,
  ActionGuideRenderOutput,
} from './types.js';

import {
  defineOk,
  defineInvalidAction,
  defineEmptySteps,
  renderOk,
  renderUnknownFormat,
} from './types.js';

export interface ActionGuideError {
  readonly code: string;
  readonly message: string;
}

export interface ActionGuideHandler {
  readonly define: (
    input: ActionGuideDefineInput,
    storage: ActionGuideStorage,
  ) => TE.TaskEither<ActionGuideError, ActionGuideDefineOutput>;
  readonly render: (
    input: ActionGuideRenderInput,
    storage: ActionGuideStorage,
  ) => TE.TaskEither<ActionGuideError, ActionGuideRenderOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): ActionGuideError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Validate that a concept name is a non-empty, kebab-case identifier. */
const isValidConceptName = (name: string): boolean =>
  /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);

/** Supported render formats. */
const SUPPORTED_FORMATS: ReadonlySet<string> = new Set(['markdown', 'text', 'html']);

/** Render a workflow record as markdown. */
const renderAsMarkdown = (
  concept: string,
  steps: readonly string[],
  content: string,
): string => {
  const header = `# Action Guide: ${concept}\n\n`;
  const description = `${content}\n\n`;
  const stepList = steps
    .map((step, idx) => `${idx + 1}. ${step}`)
    .join('\n');
  return `${header}${description}## Steps\n\n${stepList}\n`;
};

/** Render a workflow record as plain text. */
const renderAsText = (
  concept: string,
  steps: readonly string[],
  content: string,
): string => {
  const header = `Action Guide: ${concept}\n${'='.repeat(concept.length + 15)}\n\n`;
  const description = `${content}\n\n`;
  const stepList = steps
    .map((step, idx) => `  ${idx + 1}. ${step}`)
    .join('\n');
  return `${header}${description}Steps:\n${stepList}\n`;
};

/** Render a workflow record as HTML. */
const renderAsHtml = (
  concept: string,
  steps: readonly string[],
  content: string,
): string => {
  const stepItems = steps.map((s) => `  <li>${s}</li>`).join('\n');
  return `<article>\n  <h1>Action Guide: ${concept}</h1>\n  <p>${content}</p>\n  <ol>\n${stepItems}\n  </ol>\n</article>\n`;
};

// --- Implementation ---

export const actionGuideHandler: ActionGuideHandler = {
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Validate the concept name conforms to kebab-case convention
          if (!isValidConceptName(input.concept)) {
            return defineInvalidAction(input.concept);
          }

          // Guard: steps must be non-empty
          if (input.steps.length === 0) {
            return defineEmptySteps();
          }

          // Generate a workflow identifier from the concept name
          const workflow = `guide:${input.concept}`;

          // Persist the guide definition
          await storage.put('guides', workflow, {
            concept: input.concept,
            steps: [...input.steps],
            content: input.content,
            createdAt: new Date().toISOString(),
          });

          return defineOk(workflow, input.steps.length);
        },
        storageError,
      ),
    ),

  render: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Validate the format is supported
          if (!SUPPORTED_FORMATS.has(input.format)) {
            return renderUnknownFormat(input.format);
          }

          // Retrieve the stored guide record
          const record = await storage.get('guides', input.workflow);

          return pipe(
            O.fromNullable(record),
            O.fold(
              // No guide found -- return a minimal stub so the caller knows it is missing
              () => renderOk(`No guide found for workflow: ${input.workflow}`),
              (guide) => {
                const concept = (guide['concept'] as string) ?? input.workflow;
                const steps = (guide['steps'] as readonly string[]) ?? [];
                const content = (guide['content'] as string) ?? '';

                const rendered =
                  input.format === 'markdown'
                    ? renderAsMarkdown(concept, steps, content)
                    : input.format === 'html'
                      ? renderAsHtml(concept, steps, content)
                      : renderAsText(concept, steps, content);

                return renderOk(rendered);
              },
            ),
          );
        },
        storageError,
      ),
    ),
};
