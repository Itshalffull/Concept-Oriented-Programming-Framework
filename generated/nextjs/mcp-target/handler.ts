// McpTarget — Generates Model Context Protocol tool, resource, and template definitions
// from concept projections. Enforces tool count limits and description requirements.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  McpTargetStorage,
  McpTargetGenerateInput,
  McpTargetGenerateOutput,
  McpTargetValidateInput,
  McpTargetValidateOutput,
  McpTargetListToolsInput,
  McpTargetListToolsOutput,
} from './types.js';

import {
  generateOk,
  generateTooManyTools,
  validateOk,
  validateMissingDescription,
  listToolsOk,
} from './types.js';

export interface McpTargetError {
  readonly code: string;
  readonly message: string;
}

export interface McpTargetHandler {
  readonly generate: (
    input: McpTargetGenerateInput,
    storage: McpTargetStorage,
  ) => TE.TaskEither<McpTargetError, McpTargetGenerateOutput>;
  readonly validate: (
    input: McpTargetValidateInput,
    storage: McpTargetStorage,
  ) => TE.TaskEither<McpTargetError, McpTargetValidateOutput>;
  readonly listTools: (
    input: McpTargetListToolsInput,
    storage: McpTargetStorage,
  ) => TE.TaskEither<McpTargetError, McpTargetListToolsOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): McpTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** MCP tool limit — servers should keep tool counts manageable for LLM context windows. */
const MCP_TOOL_LIMIT = 128;

/** Parse a projection into concept metadata with actions and descriptions. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly { readonly name: string; readonly description?: string }[];
  readonly resources: readonly string[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly { name: string; description?: string }[] | undefined) ?? [],
      resources: (parsed['resources'] as readonly string[] | undefined) ?? [],
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: [] as readonly { readonly name: string; readonly description?: string }[],
      resources: [] as readonly string[],
    })),
  );

/** Convert a concept+action pair to an MCP tool name using snake_case convention. */
const toToolName = (concept: string, action: string): string => {
  const snake = concept.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  return `${snake}_${action.toLowerCase()}`;
};

/** Convert a concept name to an MCP resource URI template. */
const toResourceUri = (concept: string, resource: string): string =>
  `${concept.toLowerCase()}://${resource}`;

/** Derive prompt templates from concept actions. */
const toTemplateName = (concept: string, action: string): string =>
  `${concept.toLowerCase()}-${action.toLowerCase()}-template`;

// --- Implementation ---

export const mcpTargetHandler: McpTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions, resources } = parseProjection(input.projection);

          // Count existing tools to enforce the limit
          const existingTools = await storage.find('tools');
          const newToolCount = actions.length;
          const totalCount = existingTools.length + newToolCount;

          if (totalCount > MCP_TOOL_LIMIT) {
            return generateTooManyTools(totalCount, MCP_TOOL_LIMIT);
          }

          const tools: string[] = [];
          const templates: string[] = [];
          const files: string[] = [];

          // Generate tool definitions for each action
          for (const action of actions) {
            const toolName = toToolName(concept, action.name);
            tools.push(toolName);

            const templateName = toTemplateName(concept, action.name);
            templates.push(templateName);

            await storage.put('tools', toolName, {
              concept,
              toolName,
              action: action.name,
              description: action.description ?? '',
            });
          }

          // Generate resource URIs
          const resourceUris: string[] = resources.map((r) => toResourceUri(concept, r));
          for (const uri of resourceUris) {
            await storage.put('resources', uri, { concept, uri });
          }

          const fileName = `${concept.toLowerCase()}-mcp-tools.ts`;
          files.push(fileName);
          await storage.put('files', fileName, { concept, fileName, tools: [...tools] });

          return generateOk(tools, files);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const toolRecord = await storage.get('tools', input.tool);

          return pipe(
            O.fromNullable(toolRecord),
            O.fold(
              // Tool not found in storage: treat as valid (may not have been generated yet)
              () => validateOk(input.tool),
              (record) => {
                const description = record['description'] as string | undefined;
                const toolName = record['toolName'] as string | undefined;
                // MCP tools must have descriptions for LLM comprehension
                if (description === undefined || description.trim() === '') {
                  return validateMissingDescription(
                    input.tool,
                    toolName ?? input.tool,
                  );
                }
                return validateOk(input.tool);
              },
            ),
          );
        },
        storageError,
      ),
    ),

  listTools: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allTools = await storage.find('tools', { concept: input.concept });
          const allResources = await storage.find('resources', { concept: input.concept });

          const tools = allTools.map((r) => r['toolName'] as string).filter(Boolean);
          const resources = allResources.map((r) => r['uri'] as string).filter(Boolean);

          // Derive template names from tool names
          const templates = tools.map((t) => `${t}-template`);

          return listToolsOk(tools, resources, templates);
        },
        storageError,
      ),
    ),
};
