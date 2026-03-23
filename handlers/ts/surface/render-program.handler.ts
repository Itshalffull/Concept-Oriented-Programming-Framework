// @clef-handler style=imperative
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

/**
 * RenderProgram handler — imperative (bootstrap).
 *
 * Manages render program state: sequences of UI rendering instructions
 * as inspectable, composable data. Programs are sealed by pure() and
 * cannot accept further instructions once terminated.
 */
export const renderProgramHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const existing = await storage.get('programs', program);
    if (existing) return { variant: 'exists' };

    await storage.put('programs', program, {
      instructions: [],
      parts: [],
      tokens: [],
      props: [],
      terminated: false,
    });
    return { variant: 'ok' };
  },

  async element(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const part = input.part as string;
    const role = input.role as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'ok' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'element', part, role }];
    const parts = [...new Set([...(prog.parts as string[]), part])];
    await storage.put('programs', program, { ...prog, instructions, parts });
    return { variant: 'ok', program };
  },

  async text(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const part = input.part as string;
    const content = input.content as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'text', part, content }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async prop(input: Record<string, unknown>, storage: ConceptStorage) {
    if (!input.defaultValue || (typeof input.defaultValue === 'string' && (input.defaultValue as string).trim() === '')) {
      return { variant: 'notfound', output: { message: 'defaultValue is required' } };
    }
    const program = input.program as string;
    const name = input.name as string;
    const propType = input.propType as string;
    const defaultValue = input.defaultValue as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'prop', name, propType, defaultValue }];
    const props = [...new Set([...(prog.props as string[]), name])];
    await storage.put('programs', program, { ...prog, instructions, props });
    return { variant: 'ok', program };
  },

  async bind(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const part = input.part as string;
    const attr = input.attr as string;
    const expr = input.expr as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'bind', part, attr, expr }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async stateDef(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const name = input.name as string;
    const initial = input.initial as boolean;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'stateDef', name, initial }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async transition(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const fromState = input.fromState as string;
    const event = input.event as string;
    const toState = input.toState as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'transition', fromState, event, toState }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async aria(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const part = input.part as string;
    const attr = input.attr as string;
    const value = input.value as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'aria', part, attr, value }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async keyboard(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const key = input.key as string;
    const event = input.event as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'keyboard', key, event }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async focus(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const strategy = input.strategy as string;
    const initialPart = input.initialPart as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'focus', strategy, initialPart }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async compose(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const widget = input.widget as string;
    const slot = input.slot as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'compose', widget, slot }];
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async token(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const path = input.path as string;
    const fallback = input.fallback as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'token', path, fallback }];
    const tokens = [...new Set([...(prog.tokens as string[]), path])];
    await storage.put('programs', program, { ...prog, instructions, tokens });
    return { variant: 'ok', program };
  },

  async pure(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const output = input.output as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = [...(prog.instructions as unknown[]), { tag: 'pure', output }];
    await storage.put('programs', program, { ...prog, instructions, terminated: true });
    return { variant: 'ok', program };
  },
};
