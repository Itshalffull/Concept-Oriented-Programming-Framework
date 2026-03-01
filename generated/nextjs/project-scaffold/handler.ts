// ProjectScaffold — Complete project directory structure generator.
// Creates the canonical Clef project layout including repertoire/, framework/,
// score/, surface/, bind/, handlers/, and configuration files. Checks for
// existing projects to prevent accidental overwrites.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProjectScaffoldStorage,
  ProjectScaffoldScaffoldInput,
  ProjectScaffoldScaffoldOutput,
} from './types.js';

import {
  scaffoldOk,
  scaffoldAlreadyExists,
} from './types.js';

export interface ProjectScaffoldError {
  readonly code: string;
  readonly message: string;
}

export interface ProjectScaffoldHandler {
  readonly scaffold: (
    input: ProjectScaffoldScaffoldInput,
    storage: ProjectScaffoldStorage,
  ) => TE.TaskEither<ProjectScaffoldError, ProjectScaffoldScaffoldOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): ProjectScaffoldError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** The canonical Clef project directory structure. */
const PROJECT_DIRECTORIES: readonly string[] = [
  'repertoire',
  'framework',
  'score',
  'surface',
  'bind',
  'handlers/ts',
  'cli/src/commands',
  'cli/src/patterns',
  'kernel/src',
  'codegen',
  'generated',
  'tests',
];

/** Configuration files created at the project root. */
const ROOT_FILES: readonly { readonly name: string; readonly content: string }[] = [
  {
    name: 'package.json',
    content: JSON.stringify(
      {
        name: '',  // placeholder, filled per project
        version: '0.1.0',
        type: 'module',
        scripts: {
          test: 'vitest run',
          build: 'tsc --build',
        },
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^1.0.0',
          'fp-ts': '^2.16.0',
        },
      },
      null,
      2,
    ),
  },
  {
    name: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'nodenext',
          strict: true,
          outDir: 'dist',
          rootDir: '.',
        },
        include: ['**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    ),
  },
  {
    name: 'suite.yaml',
    content: '# Project suite manifest\nname: ""\nconcepts: []\n',
  },
];

// --- Implementation ---

export const projectScaffoldHandler: ProjectScaffoldHandler = {
  scaffold: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name } = input;

          // Check if a project with this name already exists
          const existing = await storage.get('projects', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              async () => {
                const projectPath = `projects/${name}`;

                // Build the directory manifest
                const directories = PROJECT_DIRECTORIES.map((dir) => `${projectPath}/${dir}`);

                // Build the file manifest with the project name interpolated
                const files = ROOT_FILES.map((f) => ({
                  path: `${projectPath}/${f.name}`,
                  content:
                    f.name === 'package.json'
                      ? f.content.replace('"name": ""', `"name": "@clef/${name}"`)
                      : f.name === 'suite.yaml'
                        ? f.content.replace('name: ""', `name: "${name}"`)
                        : f.content,
                }));

                // Persist the project record
                await storage.put('projects', name, {
                  name,
                  path: projectPath,
                  directories,
                  files: files.map((f) => f.path),
                  createdAt: new Date().toISOString(),
                });

                return scaffoldOk(name, projectPath);
              },
              async (_existingProject) => scaffoldAlreadyExists(name),
            ),
          );
        },
        storageError,
      ),
    ),
};
