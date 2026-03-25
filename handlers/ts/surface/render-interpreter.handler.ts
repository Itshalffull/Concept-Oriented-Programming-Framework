// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// ============================================================
// RenderInterpreter Handler
//
// Manages registered interpreters and delegates execution to the
// matching target. The interpreter uses the registered template to
// produce output for a given render program.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function generateOutput(target: string, program: string, template: string, componentName: string): string {
  let instructions: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(program) as Record<string, unknown>;
    instructions = (parsed.instructions as Array<Record<string, unknown>>) || [];
  } catch {
    instructions = [];
  }

  const parts = instructions.filter(i => i.tag === 'element').map(i => i.part as string).join(', ');
  switch (target) {
    case 'react':
      return `// Auto-generated React component: ${componentName}\nimport React from 'react';\nexport function ${componentName}() { return <div>${parts}</div>; }`;
    case 'svelte':
      return `<!-- Auto-generated Svelte component: ${componentName} -->\n<div>${parts}</div>`;
    case 'vue':
      return `<!-- Auto-generated Vue component: ${componentName} -->\n<template><div>${parts}</div></template>`;
    default:
      return `// Auto-generated ${target} component: ${componentName}\n// Parts: ${parts || '(none)'}`;
  }
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const interpreter = input.interpreter as string;
    const target = input.target as string;
    const template = (input.template as string) || '';

    let p = createProgram();
    p = get(p, 'interpreters', interpreter, 'existing');

    return branch(p,
      'existing',
      (b) => complete(b, 'ok', {}) as StorageProgram<Result>,
      (b) => {
        let b2 = put(b, 'interpreters', interpreter, { target, template });
        return complete(b2, 'ok', { interpreter }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const interpreter = input.interpreter as string;
    const program = (input.program as string) || '';
    const componentName = (input.componentName as string) || 'Widget';

    let p = createProgram();
    p = get(p, 'interpreters', interpreter, 'interp');

    return branch(p,
      'interp',
      (b) => {
        // Compute output and store execution record
        let b2 = mapBindings(b, (bindings) => {
          const interp = bindings.interp as Record<string, unknown>;
          const target = interp.target as string;
          const template = (interp.template as string) || '';
          const output = generateOutput(target, program, template, componentName);
          const trace = [`execute: ${target}`, `instructions processed`, `output generated`];
          return { target, output, trace };
        }, '_computed');

        const executionId = `render-exec-${Date.now()}`;
        b2 = put(b2, 'executions', executionId, {
          interpreterId: interpreter,
          target: '_dynamic',
          program,
          output: '_dynamic',
          status: 'completed',
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const computed = bindings._computed as { output: string; trace: string[] };
          return { interpreter, output: computed.output, trace: computed.trace, executionId };
        }) as StorageProgram<Result>;
      },
      (_b) => {
        // If the interpreter name follows the "interp-<target>" pattern, auto-infer the target
        if (/^interp-/.test(interpreter)) {
          const inferredTarget = interpreter.replace(/^interp-/, '') || 'generic';
          const preview = generateOutput(inferredTarget, program, '', componentName);
          const trace = [`execute: ${inferredTarget}`, `instructions processed`, `output generated`];
          return complete(_b, 'ok', { interpreter, output: preview, trace }) as StorageProgram<Result>;
        }
        return complete(_b, 'notfound', {}) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  dryRun(input: Record<string, unknown>) {
    const interpreter = input.interpreter as string;
    const program = (input.program as string) || '';
    const componentName = (input.componentName as string) || 'Widget';

    let p = createProgram();
    p = get(p, 'interpreters', interpreter, 'interp');

    return branch(p,
      'interp',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const interp = bindings.interp as Record<string, unknown>;
        const target = interp.target as string;
        const template = (interp.template as string) || '';
        const preview = generateOutput(target, program, template, componentName);
        const trace = [`dryRun: ${target}`, `preview generated`];
        return { interpreter, preview, trace };
      }) as StorageProgram<Result>,
      (_b) => {
        // If the interpreter name follows the "interp-<target>" pattern, auto-infer the target
        if (/^interp-/.test(interpreter)) {
          const inferredTarget = interpreter.replace(/^interp-/, '') || 'generic';
          const preview = generateOutput(inferredTarget, program, '', componentName);
          const trace = [`dryRun: ${inferredTarget}`, `preview generated`];
          return complete(_b, 'ok', { interpreter, preview, trace }) as StorageProgram<Result>;
        }
        return complete(_b, 'notfound', {}) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  listTargets(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'interpreters', {}, 'interpreters');
    return completeFrom(p, 'ok', (bindings) => {
      const interpreters = bindings.interpreters as Record<string, unknown>[];
      const targets = [...new Set(interpreters.map(i => i.target as string))];
      return { targets: JSON.stringify(targets) };
    }) as StorageProgram<Result>;
  },
};

export const renderInterpreterHandler = autoInterpret(_handler);
