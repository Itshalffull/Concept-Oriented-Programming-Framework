// @migrated dsl-constructs 2026-03-18
// Middleware Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _interfaceMiddlewareHandler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const traits = JSON.parse(input.traits as string) as string[];
    const target = input.target as string;

    let p = createProgram();
    p = find(p, 'middleware', {}, 'allDefinitions');
    return complete(p, 'ok', {
      middlewares: JSON.stringify([]),
      order: JSON.stringify([]),
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  inject(input: Record<string, unknown>) {
    const output = input.output as string;
    const middlewares = JSON.parse(input.middlewares as string) as string[];
    const target = input.target as string;

    let injectedOutput = output;
    let injectedCount = 0;

    for (const mw of middlewares) {
      if (target === 'rest') { injectedOutput = `app.use(${mw});\n${injectedOutput}`; }
      else if (target === 'grpc') { injectedOutput = `server.addInterceptor(${mw});\n${injectedOutput}`; }
      else if (target === 'cli') { injectedOutput = `program.hook('preAction', ${mw});\n${injectedOutput}`; }
      else if (target === 'mcp') { injectedOutput = `server.addMiddleware(${mw});\n${injectedOutput}`; }
      else { injectedOutput = `// middleware: ${mw}\n${injectedOutput}`; }
      injectedCount++;
    }

    const p = createProgram();
    return complete(p, 'ok', { output: injectedOutput, injectedCount }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  register(input: Record<string, unknown>) {
    const trait = input.trait as string;
    const target = input.target as string;
    const implementation = input.implementation as string;
    const position = input.position as string;

    const POSITION_ORDER: Record<string, number> = {
      'before-auth': 0, 'auth': 1, 'after-auth': 2,
      'validation': 3, 'business-logic': 4, 'serialization': 5,
    };

    const registrationKey = `${trait}::${target}`;

    let p = createProgram();
    p = spGet(p, 'middleware', registrationKey, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicateRegistration', { trait, target }),
      (b) => {
        let b2 = put(b, 'middleware', registrationKey, {
          traitName: trait, scope: 'action', config: '{}',
          target, implementation, code: implementation, position,
          order: POSITION_ORDER[position] ?? 99,
          dependsOn: '[]', incompatibleWith: '[]',
        });
        return complete(b2, 'ok', { middleware: registrationKey });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const interfaceMiddlewareHandler = autoInterpret(_interfaceMiddlewareHandler);

