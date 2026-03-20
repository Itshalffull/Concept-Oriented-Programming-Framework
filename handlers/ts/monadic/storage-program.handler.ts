// @clef-handler style=imperative
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

export const storageProgramHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const existing = await storage.get('programs', program);
    if (existing) {
      return { variant: 'exists' };
    }
    await storage.put('programs', program, {
      instructions: [],
      bindings: [],
      terminated: false,
    });
    return { variant: 'ok' };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const relation = input.relation as string;
    const key = input.key as string;
    const bindAs = input.bindAs as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = (prog.instructions as unknown[]) || [];
    instructions.push({ tag: 'get', relation, key, bindAs });
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async find(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const relation = input.relation as string;
    const criteria = input.criteria as string;
    const bindAs = input.bindAs as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = (prog.instructions as unknown[]) || [];
    instructions.push({ tag: 'find', relation, criteria, bindAs });
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async put(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const relation = input.relation as string;
    const key = input.key as string;
    const value = input.value as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = (prog.instructions as unknown[]) || [];
    instructions.push({ tag: 'put', relation, key, value });
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async del(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const relation = input.relation as string;
    const key = input.key as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = (prog.instructions as unknown[]) || [];
    instructions.push({ tag: 'del', relation, key });
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async branch(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const condition = input.condition as string;
    const thenBranch = input.thenBranch as string;
    const elseBranch = input.elseBranch as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const thenProg = await storage.get('programs', thenBranch);
    const elseProg = await storage.get('programs', elseBranch);
    if (!thenProg || !elseProg) return { variant: 'notfound' };

    const instructions = (prog.instructions as unknown[]) || [];
    instructions.push({ tag: 'branch', condition, thenBranch, elseBranch });
    await storage.put('programs', program, { ...prog, instructions });
    return { variant: 'ok', program };
  },

  async pure(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const variant = input.variant as string;
    const output = input.output as string;

    const prog = await storage.get('programs', program);
    if (!prog) return { variant: 'notfound' };
    if (prog.terminated) return { variant: 'sealed' };

    const instructions = (prog.instructions as unknown[]) || [];
    instructions.push({ tag: 'pure', variant, output });
    await storage.put('programs', program, { ...prog, instructions, terminated: true });
    return { variant: 'ok', program };
  },

  async compose(input: Record<string, unknown>, storage: ConceptStorage) {
    const first = input.first as string;
    const second = input.second as string;
    const bindAs = input.bindAs as string;

    const firstProg = await storage.get('programs', first);
    const secondProg = await storage.get('programs', second);
    if (!firstProg || !secondProg) return { variant: 'notfound' };

    const composedId = `composed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put('programs', composedId, {
      instructions: [{ tag: 'bind', first, bindAs, second }],
      bindings: [],
      terminated: !!(secondProg.terminated),
    });
    return { variant: 'ok', program: composedId };
  },
};
