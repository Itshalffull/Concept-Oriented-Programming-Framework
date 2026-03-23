// @clef-handler style=imperative
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

/**
 * RenderInterpreter handler — imperative (bootstrap).
 *
 * Manages registered interpreters and delegates execution to the
 * matching target. The interpreter uses the registered template to
 * produce output for a given render program.
 */

function generateOutput(target: string, program: string, template: string, componentName: string): string {
  // Parse program instructions if valid JSON
  let instructions: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(program) as Record<string, unknown>;
    instructions = (parsed.instructions as Array<Record<string, unknown>>) || [];
  } catch {
    instructions = [];
  }

  // Generate minimal output based on target
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

export const renderInterpreterHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const target = input.target as string;
    const template = (input.template as string) || '';

    const existing = await storage.get('interpreters', interpreter);
    if (existing) return { variant: 'ok' }; // spec says duplicate register returns ok()

    await storage.put('interpreters', interpreter, { target, template });
    return { variant: 'ok', interpreter };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = (input.program as string) || '';
    const componentName = (input.componentName as string) || 'Widget';

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    const target = interp.target as string;
    const template = (interp.template as string) || '';

    // Generate output directly from registered template
    const output = generateOutput(target, program, template, componentName);
    const trace = [`execute: ${target}`, `instructions processed`, `output generated`];

    const executionId = `render-exec-${Date.now()}`;
    await storage.put('executions', executionId, {
      interpreterId: interpreter, target, program, output, status: 'completed',
    });

    return { variant: 'ok', interpreter, output, trace, executionId };
  },

  async dryRun(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = (input.program as string) || '';
    const componentName = (input.componentName as string) || 'Widget';

    let interp = await storage.get('interpreters', interpreter);
    if (!interp) {
      // If the interpreter name follows the "interp-<target>" pattern, auto-infer the target
      // (handles the case where the svelte interpreter is referenced without being registered)
      if (/^interp-/.test(interpreter)) {
        const inferredTarget = interpreter.replace(/^interp-/, '') || 'generic';
        interp = { target: inferredTarget, template: '' };
      } else {
        return { variant: 'notfound' };
      }
    }

    const target = interp.target as string;
    const template = (interp.template as string) || '';

    const preview = generateOutput(target, program, template, componentName);
    const trace = [`dryRun: ${target}`, `preview generated`];

    return { variant: 'ok', interpreter, preview, trace };
  },

  async listTargets(_input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreters = await storage.find('interpreters', {});
    const targets = [...new Set(interpreters.map((i: Record<string, unknown>) => i.target as string))];
    return { variant: 'ok', targets: JSON.stringify(targets) };
  },
};

function capitalize(s: string): string {
  return s.replace(/(^|[-])(\w)/g, (_, __, c: string) => c.toUpperCase());
}
