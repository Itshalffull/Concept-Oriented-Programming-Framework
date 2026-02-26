// ============================================================
// clef init <name>
//
// Scaffolds a new Clef project directory with the standard
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

const TEMPLATE_IMPL = `import type { ConceptHandler } from '@clef/runtime';

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
      "@clef/runtime": ["./runtime/index.ts"],
      "@clef/runtime/*": ["./runtime/*"]
    }
  },
  "include": [
    "runtime/**/*.ts",
    "handlers/**/*.ts",
    "tests/**/*.ts",
    "cli/**/*.ts"
  ]
}
`;

const TEMPLATE_GITIGNORE = `node_modules/
dist/
generated/
bind/
.clef/
*.js
*.d.ts
*.js.map
*.d.ts.map
!vitest.config.ts
`;

const TEMPLATE_CLEF_YAML = `# Clef Project Configuration
name: {{NAME}}
version: 0.1.0

# Target languages for code generation
targets:
  - typescript

# Adapters and storage
adapters:
  storage: sqlite
  transport: http
`;

export async function initCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const name = positional[0];
  if (!name) {
    console.error('Usage: clef init <project-name>');
    process.exit(1);
  }

  const projectDir = resolve(process.cwd(), name);

  if (existsSync(projectDir)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  console.log(`Initializing Clef project: ${name}`);

  // Create directory structure per clef-naming-reference.md
  const dirs = [
    '',
    'concepts',
    'syncs',
    'widgets',
    'themes',
    'interfaces',
    'deploys',
    'suites',
    'handlers/ts',
    'generated/ts',
    'generated/graphql',
    'generated/openapi',
    'bind/rest',
    'bind/cli',
    'bind/mcp',
    'tests/conformance',
    'tests/contract',
    'tests/integration',
    'migrations',
    '.clef/score',
    '.clef/build',
    '.clef/cache',
  ];

  for (const dir of dirs) {
    mkdirSync(join(projectDir, dir), { recursive: true });
  }

  // Write template files
  writeFileSync(join(projectDir, '.gitignore'), TEMPLATE_GITIGNORE);
  writeFileSync(
    join(projectDir, 'clef.yaml'),
    TEMPLATE_CLEF_YAML.replace(/\{\{NAME\}\}/g, name),
  );
  writeFileSync(join(projectDir, 'tsconfig.json'), TEMPLATE_TSCONFIG);

  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        description: `${name} — built with Clef`,
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
      '@clef/runtime': path.resolve(__dirname, './runtime/index.ts'),
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
  writeFileSync(join(projectDir, 'concepts/hello.concept'), TEMPLATE_CONCEPT);
  writeFileSync(join(projectDir, 'syncs/hello.sync'), TEMPLATE_SYNC);
  writeFileSync(
    join(projectDir, 'handlers/ts/hello.handler.ts'),
    TEMPLATE_IMPL,
  );

  // Empty deployment manifest
  writeFileSync(
    join(projectDir, 'deploys/local.deploy.yaml'),
    `# Clef Deployment Manifest

runtimes: []
concepts: []
syncs: []
`,
  );

  // Example interface manifest
  writeFileSync(
    join(projectDir, 'interfaces/api.interface.yaml'),
    `interface:
  name: ${name}-api
  version: "0.1.0"

targets:
  rest:
    basePath: /api
    framework: hono

specs:
  openapi: true

output:
  dir: ./bind
  clean: true
`,
  );

  console.log(`
Project created at ./${name}/

  clef.yaml                   Project configuration
  concepts/hello.concept      Example concept spec
  syncs/hello.sync            Example synchronization
  handlers/ts/                Concept handlers
  interfaces/                 Interface manifests (Bind)
  deploys/                    Deployment manifests

Next steps:
  cd ${name}
  npm install
  clef check
  clef generate --target typescript
`);
}
