// WidgetGen — Widget code generation from parsed widget spec AST
// Transforms a widget AST into target-specific component code (React, Vue, Svelte, etc.).

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  WidgetGenStorage,
  WidgetGenGenerateInput,
  WidgetGenGenerateOutput,
} from './types.js';

import {
  generateOk,
  generateError,
} from './types.js';

export interface WidgetGenError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetGenHandler {
  readonly generate: (
    input: WidgetGenGenerateInput,
    storage: WidgetGenStorage,
  ) => TE.TaskEither<WidgetGenError, WidgetGenGenerateOutput>;
}

// --- Helpers ---

const toError = (error: unknown): WidgetGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SUPPORTED_TARGETS: readonly string[] = ['react', 'vue', 'svelte', 'solid', 'html'];

/** Generate a React component from widget AST. */
const generateReact = (widgetName: string, ast: Record<string, unknown>): string => {
  const parts = Array.isArray(ast['parts']) ? ast['parts'] as readonly Record<string, unknown>[] : [];
  const props = Array.isArray(ast['props']) ? ast['props'] as readonly string[] : [];
  const propsInterface = props.length > 0
    ? `interface ${widgetName}Props {\n${props.map((p) => `  readonly ${p}: unknown;`).join('\n')}\n}`
    : `interface ${widgetName}Props {}`;
  const partElements = parts.map((p) => {
    const role = String(p['role'] ?? 'div');
    const name = String(p['name'] ?? 'part');
    return `      <div data-part="${name}" role="${role}" />`;
  }).join('\n');
  return `${propsInterface}\n\nexport const ${widgetName}: React.FC<${widgetName}Props> = (props) => {\n  return (\n    <div data-widget="${widgetName}">\n${partElements}\n    </div>\n  );\n};`;
};

/** Generate a Vue SFC from widget AST. */
const generateVue = (widgetName: string, ast: Record<string, unknown>): string => {
  const parts = Array.isArray(ast['parts']) ? ast['parts'] as readonly Record<string, unknown>[] : [];
  const partElements = parts.map((p) => {
    const name = String(p['name'] ?? 'part');
    return `    <div data-part="${name}" />`;
  }).join('\n');
  return `<template>\n  <div data-widget="${widgetName}">\n${partElements}\n  </div>\n</template>\n\n<script setup lang="ts">\ndefineProps<{}>();\n</script>`;
};

/** Generate a Svelte component from widget AST. */
const generateSvelte = (widgetName: string, ast: Record<string, unknown>): string => {
  const parts = Array.isArray(ast['parts']) ? ast['parts'] as readonly Record<string, unknown>[] : [];
  const partElements = parts.map((p) => {
    const name = String(p['name'] ?? 'part');
    return `  <div data-part="${name}" />`;
  }).join('\n');
  return `<script lang="ts">\n</script>\n\n<div data-widget="${widgetName}">\n${partElements}\n</div>`;
};

/** Generate plain HTML from widget AST. */
const generateHtml = (widgetName: string, ast: Record<string, unknown>): string => {
  const parts = Array.isArray(ast['parts']) ? ast['parts'] as readonly Record<string, unknown>[] : [];
  const partElements = parts.map((p) => {
    const name = String(p['name'] ?? 'part');
    return `  <div data-part="${name}"></div>`;
  }).join('\n');
  return `<div data-widget="${widgetName}">\n${partElements}\n</div>`;
};

// --- Implementation ---

export const widgetGenHandler: WidgetGenHandler = {
  // Generate widget component code from a parsed AST for the specified target framework
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!SUPPORTED_TARGETS.includes(input.target)) {
            return generateError(input.gen, `Unsupported target '${input.target}'. Supported: ${SUPPORTED_TARGETS.join(', ')}`);
          }
          let ast: Record<string, unknown>;
          try {
            ast = JSON.parse(input.widgetAst) as Record<string, unknown>;
          } catch {
            return generateError(input.gen, 'Widget AST is not valid JSON');
          }
          const widgetName = String(ast['name'] ?? input.gen);
          let output: string;
          switch (input.target) {
            case 'react': output = generateReact(widgetName, ast); break;
            case 'vue': output = generateVue(widgetName, ast); break;
            case 'svelte': output = generateSvelte(widgetName, ast); break;
            case 'html': output = generateHtml(widgetName, ast); break;
            default: output = generateHtml(widgetName, ast); break;
          }
          // Cache the generated output for incremental rebuilds
          await storage.put('widget_gen', `${input.gen}::${input.target}`, {
            gen: input.gen,
            target: input.target,
            output,
            generatedAt: new Date().toISOString(),
          });
          return generateOk(input.gen, output);
        },
        toError,
      ),
    ),
};
