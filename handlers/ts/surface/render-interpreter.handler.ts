import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

/**
 * RenderInterpreter handler — imperative (bootstrap).
 *
 * Executes a RenderProgram against a registered target framework,
 * producing framework-specific code. Supports dry-run for preview
 * without persisting execution state.
 */

type RenderInstruction = {
  tag: string;
  [key: string]: unknown;
};

function interpretInstructions(instructions: RenderInstruction[], target: string, template: string): { output: string; trace: string[] } {
  const trace: string[] = [];
  const outputParts: string[] = [];

  for (const instr of instructions) {
    trace.push(`[${target}] ${instr.tag}: ${JSON.stringify(instr)}`);

    switch (instr.tag) {
      case 'element':
        outputParts.push(`<${instr.part} role="${instr.role}">`);
        break;
      case 'text':
        outputParts.push(`  ${instr.content}`);
        break;
      case 'prop':
        outputParts.push(`prop ${instr.name}: ${instr.propType} = ${instr.defaultValue}`);
        break;
      case 'bind':
        outputParts.push(`  ${instr.part}.${instr.attr} = {${instr.expr}}`);
        break;
      case 'stateDef':
        outputParts.push(`state ${instr.name}${instr.initial ? ' (initial)' : ''}`);
        break;
      case 'transition':
        outputParts.push(`${instr.fromState} --[${instr.event}]--> ${instr.toState}`);
        break;
      case 'aria':
        outputParts.push(`  ${instr.part}[aria-${instr.attr}="${instr.value}"]`);
        break;
      case 'keyboard':
        outputParts.push(`key ${instr.key} => ${instr.event}`);
        break;
      case 'focus':
        outputParts.push(`focus: ${instr.strategy} on ${instr.initialPart}`);
        break;
      case 'compose':
        outputParts.push(`  <${instr.widget} slot="${instr.slot}" />`);
        break;
      case 'token':
        outputParts.push(`token(${instr.path}, fallback: ${instr.fallback})`);
        break;
      case 'pure':
        trace.push(`[${target}] terminated with output: ${instr.output}`);
        break;
    }
  }

  return { output: outputParts.join('\n'), trace };
}

export const renderInterpreterHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const target = input.target as string;
    const template = input.template as string;

    const existing = await storage.get('interpreters', interpreter);
    if (existing) return { variant: 'exists' };

    await storage.put('interpreters', interpreter, { target, template });
    return { variant: 'ok', interpreter };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = input.program as string;
    const snapshot = input.snapshot as string;

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    let instructions: RenderInstruction[];
    try {
      const parsed = JSON.parse(program);
      instructions = parsed.instructions || [];
    } catch {
      return { variant: 'error', message: `Invalid program data: could not parse instructions` };
    }

    const target = interp.target as string;
    const template = interp.template as string;
    const { output, trace } = interpretInstructions(instructions, target, template);

    const executionId = `render-exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put('executions', executionId, {
      interpreterId: interpreter,
      program,
      snapshot,
      output,
      trace: JSON.stringify(trace),
      completedAt: new Date().toISOString(),
    });

    return { variant: 'ok', interpreter, output, trace: JSON.stringify(trace) };
  },

  async dryRun(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = input.program as string;

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    let instructions: RenderInstruction[];
    try {
      const parsed = JSON.parse(program);
      instructions = parsed.instructions || [];
    } catch {
      instructions = [];
    }

    const target = interp.target as string;
    const template = interp.template as string;
    const { output, trace } = interpretInstructions(instructions, target, template);

    return { variant: 'ok', interpreter, preview: output, trace: JSON.stringify(trace) };
  },

  async listTargets(_input: Record<string, unknown>, storage: ConceptStorage) {
    const all = await storage.find('interpreters', {});
    const targets = (all || []).map((entry: Record<string, unknown>) => entry.target as string);
    return { variant: 'ok', targets: JSON.stringify(targets) };
  },
};
