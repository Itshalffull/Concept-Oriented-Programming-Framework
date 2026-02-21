// Middleware Concept Implementation (Interface Kit)
import type { ConceptHandler } from '@copf/kernel';

/** Numeric ordering for middleware positions. Lower values run first. */
const POSITION_ORDER: Record<string, number> = {
  'before-auth': 0,
  'auth': 1,
  'after-auth': 2,
  'validation': 3,
  'business-logic': 4,
  'serialization': 5,
};

export const interfaceMiddlewareHandler: ConceptHandler = {
  async resolve(input, storage) {
    const traits = JSON.parse(input.traits as string) as string[];
    const target = input.target as string;

    const allDefinitions = await storage.find('middleware');
    const resolved: Array<{ name: string; code: string; order: number }> = [];
    const warnings: string[] = [];

    // Check for incompatible trait pairs
    for (let i = 0; i < traits.length; i++) {
      for (let j = i + 1; j < traits.length; j++) {
        const defI = allDefinitions.find(
          (d) => d.traitName === traits[i] && d.target === target,
        );
        if (defI) {
          const incompatible = JSON.parse((defI.incompatibleWith as string) || '[]') as string[];
          if (incompatible.includes(traits[j])) {
            return {
              variant: 'incompatibleTraits',
              trait1: traits[i],
              trait2: traits[j],
              reason: `Traits "${traits[i]}" and "${traits[j]}" cannot be used together`,
            };
          }
        }
      }
    }

    // Resolve each trait to its target-specific implementation
    for (const trait of traits) {
      const definition = allDefinitions.find(
        (d) => d.traitName === trait && d.target === target,
      );

      if (!definition) {
        warnings.push(`No implementation for trait "${trait}" on target "${target}"`);
        return {
          variant: 'missingImplementation',
          trait,
          target,
        };
      }

      const position = definition.position as string;
      const order = POSITION_ORDER[position] ?? 99;

      resolved.push({
        name: definition.implementation as string,
        code: definition.code as string || definition.implementation as string,
        order,
      });
    }

    // Sort by position order
    resolved.sort((a, b) => a.order - b.order);

    const middlewares = resolved.map((r) => r.name);
    const order = resolved.map((r) => r.order);

    return {
      variant: 'ok',
      middlewares: JSON.stringify(middlewares),
      order: JSON.stringify(order),
    };
  },

  async inject(input, _storage) {
    const output = input.output as string;
    const middlewares = JSON.parse(input.middlewares as string) as string[];
    const target = input.target as string;

    let injectedOutput = output;
    let injectedCount = 0;

    for (const mw of middlewares) {
      if (target === 'rest') {
        injectedOutput = `app.use(${mw});\n${injectedOutput}`;
      } else if (target === 'grpc') {
        injectedOutput = `server.addInterceptor(${mw});\n${injectedOutput}`;
      } else if (target === 'cli') {
        injectedOutput = `program.hook('preAction', ${mw});\n${injectedOutput}`;
      } else if (target === 'mcp') {
        injectedOutput = `server.addMiddleware(${mw});\n${injectedOutput}`;
      } else {
        injectedOutput = `// middleware: ${mw}\n${injectedOutput}`;
      }
      injectedCount++;
    }

    return { variant: 'ok', output: injectedOutput, injectedCount };
  },

  async register(input, storage) {
    const trait = input.trait as string;
    const target = input.target as string;
    const implementation = input.implementation as string;
    const position = input.position as string;

    const registrationKey = `${trait}::${target}`;

    // Check for duplicate
    const existing = await storage.get('middleware', registrationKey);
    if (existing) {
      return { variant: 'duplicateRegistration', trait, target };
    }

    await storage.put('middleware', registrationKey, {
      traitName: trait,
      scope: 'action',
      config: '{}',
      target,
      implementation,
      code: implementation,
      position,
      order: POSITION_ORDER[position] ?? 99,
      dependsOn: '[]',
      incompatibleWith: '[]',
    });

    return { variant: 'ok', middleware: registrationKey };
  },
};
