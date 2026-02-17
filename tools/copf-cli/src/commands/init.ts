// ============================================================
// copf init <name>
//
// Scaffolds a new COPF project directory with the standard
// layout described in Section 11 of the architecture doc.
// ============================================================

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const TEMPLATE_CONCEPT = `concept Hello [U] {

  purpose {
    A minimal example concept that greets users.
  }

  state {
    greeting: U -> String
  }

  actions {
    action greet(user: U, name: String) {
      -> ok(message: String) {
        Store a greeting for the user and return it.
      }
    }
  }

  invariant {
    after greet(user: x, name: "World") -> ok(message: m)
    then greet(user: x, name: "World") -> ok(message: m)
  }
}
`;

const TEMPLATE_SYNC = `sync GreetFromWeb [eager]
when {
  Web/request: [ method: "greet"; name: ?name ]
    => [ request: ?request ]
}
where {
  bind(uuid() as ?user)
}
then {
  Hello/greet: [ user: ?user; name: ?name ]
}

sync RespondGreet [eager]
when {
  Web/request: [ method: "greet" ]
    => [ request: ?request ]
  Hello/greet: []
    => [ message: ?message ]
}
then {
  Web/respond: [ request: ?request; body: { message: ?message } ]
}
`;

const TEMPLATE_IMPL = `import type { ConceptHandler } from '@copf/kernel';

export const helloHandler: ConceptHandler = {
  async greet(input, storage) {
    const user = input.user as string;
    const name = input.name as string;
    const message = \`Hello, \${name}!\`;

    await storage.put('hello', user, { user, greeting: message });

    return { variant: 'ok', message };
  },
};
`;

const TEMPLATE_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "paths": {
      "@copf/kernel": ["./kernel/src/index.ts"],
      "@copf/kernel/*": ["./kernel/src/*"]
    }
  },
  "include": [
    "kernel/src/**/*.ts",
    "implementations/**/*.ts",
    "tests/**/*.ts",
    "tools/**/*.ts"
  ]
}
`;

const TEMPLATE_GITIGNORE = `node_modules/
dist/
generated/
*.js
*.d.ts
*.js.map
*.d.ts.map
!vitest.config.ts
`;

export async function initCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const name = positional[0];
  if (!name) {
    console.error('Usage: copf init <project-name>');
    process.exit(1);
  }

  const projectDir = resolve(process.cwd(), name);

  if (existsSync(projectDir)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  console.log(`Initializing COPF project: ${name}`);

  // Create directory structure (Section 11)
  const dirs = [
    '',
    'specs/app',
    'specs/framework',
    'syncs/app',
    'syncs/framework',
    'implementations/typescript/app',
    'implementations/typescript/framework',
    'tests',
    'generated/schemas/graphql',
    'generated/schemas/json',
    'generated/typescript',
    'deploy',
    'kits',
  ];

  for (const dir of dirs) {
    mkdirSync(join(projectDir, dir), { recursive: true });
  }

  // Write template files
  writeFileSync(join(projectDir, '.gitignore'), TEMPLATE_GITIGNORE);
  writeFileSync(join(projectDir, 'tsconfig.json'), TEMPLATE_TSCONFIG);

  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        description: `${name} — built with COPF`,
        private: true,
        type: 'module',
        scripts: {
          build: 'tsc',
          test: 'vitest run',
          'test:watch': 'vitest',
        },
        devDependencies: {
          typescript: '^5.4.0',
          vitest: '^1.6.0',
          '@types/node': '^20.0.0',
        },
      },
      null,
      2,
    ) + '\n',
  );

  writeFileSync(
    join(projectDir, 'vitest.config.ts'),
    `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@copf/kernel': path.resolve(__dirname, './kernel/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});
`,
  );

  // Example concept, sync, and implementation
  writeFileSync(join(projectDir, 'specs/app/hello.concept'), TEMPLATE_CONCEPT);
  writeFileSync(join(projectDir, 'syncs/app/hello.sync'), TEMPLATE_SYNC);
  writeFileSync(
    join(projectDir, 'implementations/typescript/app/hello.impl.ts'),
    TEMPLATE_IMPL,
  );

  // Empty deployment manifest
  writeFileSync(
    join(projectDir, 'deploy/app.deploy.yaml'),
    `# COPF Deployment Manifest
# See Section 6 of the architecture doc.

runtimes: []
concepts: []
syncs: []
`,
  );

  console.log(`
Project created at ./${name}/

  specs/app/hello.concept     Example concept spec
  syncs/app/hello.sync        Example synchronization
  implementations/            Concept implementations

Next steps:
  cd ${name}
  npm install
  copf check
  copf generate --target typescript
`);
}
