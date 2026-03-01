// DockerComposeIacProvider — Generates Docker Compose YAML from concept deployment specs.
// Maps concepts to services, configures networking, volumes, and environment variables.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  DockerComposeIacProviderStorage,
  DockerComposeIacProviderGenerateInput,
  DockerComposeIacProviderGenerateOutput,
  DockerComposeIacProviderPreviewInput,
  DockerComposeIacProviderPreviewOutput,
  DockerComposeIacProviderApplyInput,
  DockerComposeIacProviderApplyOutput,
  DockerComposeIacProviderTeardownInput,
  DockerComposeIacProviderTeardownOutput,
} from './types.js';

import {
  generateOk,
  previewOk,
  applyOk,
  applyPortConflict,
  teardownOk,
} from './types.js';

export interface DockerComposeIacProviderError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): DockerComposeIacProviderError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

// --- Pure helpers ---

/** Derive a Docker service name from a concept plan identifier. */
const toServiceName = (concept: string): string =>
  concept.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

/** Assign a deterministic port offset from a service name hash. */
const assignPort = (serviceName: string, basePort: number): number => {
  const hash = serviceName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return basePort + (hash % 100);
};

/** Build a Compose service block for a single concept. */
const buildServiceBlock = (concept: Record<string, unknown>): string => {
  const name = toServiceName(String(concept['name'] ?? concept['concept'] ?? 'svc'));
  const image = String(concept['image'] ?? `clef/${name}:latest`);
  const port = assignPort(name, 3000);
  const env = concept['env'] as Record<string, string> | undefined;
  const envLines = env
    ? Object.entries(env).map(([k, v]) => `      - ${k}=${v}`).join('\n')
    : '';

  return [
    `  ${name}:`,
    `    image: ${image}`,
    `    ports:`,
    `      - "${port}:${port}"`,
    ...(envLines ? [`    environment:`, envLines] : []),
    `    networks:`,
    `      - clef-net`,
  ].join('\n');
};

/** Assemble a full docker-compose.yml from a list of service blocks. */
const assembleComposeFile = (serviceBlocks: readonly string[]): string =>
  [
    'version: "3.8"',
    '',
    'services:',
    ...serviceBlocks,
    '',
    'networks:',
    '  clef-net:',
    '    driver: bridge',
  ].join('\n');

export interface DockerComposeIacProviderHandler {
  readonly generate: (
    input: DockerComposeIacProviderGenerateInput,
    storage: DockerComposeIacProviderStorage,
  ) => TE.TaskEither<DockerComposeIacProviderError, DockerComposeIacProviderGenerateOutput>;
  readonly preview: (
    input: DockerComposeIacProviderPreviewInput,
    storage: DockerComposeIacProviderStorage,
  ) => TE.TaskEither<DockerComposeIacProviderError, DockerComposeIacProviderPreviewOutput>;
  readonly apply: (
    input: DockerComposeIacProviderApplyInput,
    storage: DockerComposeIacProviderStorage,
  ) => TE.TaskEither<DockerComposeIacProviderError, DockerComposeIacProviderApplyOutput>;
  readonly teardown: (
    input: DockerComposeIacProviderTeardownInput,
    storage: DockerComposeIacProviderStorage,
  ) => TE.TaskEither<DockerComposeIacProviderError, DockerComposeIacProviderTeardownOutput>;
}

// --- Implementation ---

export const dockerComposeIacProviderHandler: DockerComposeIacProviderHandler = {
  /** Parse the deploy plan, extract concepts, and generate a docker-compose.yml. */
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('deploy_plan', { plan: input.plan }),
        mkError('PLAN_LOOKUP_FAILED'),
      ),
      TE.chain((planRecords) => {
        const concepts = planRecords.length > 0
          ? planRecords
          : [{ name: input.plan, image: `clef/${toServiceName(input.plan)}:latest` }];

        const serviceBlocks = concepts.map(buildServiceBlock);
        const composeContent = assembleComposeFile(serviceBlocks);
        const composeFile = `docker-compose-${toServiceName(input.plan)}.yml`;
        const files = [composeFile];

        return TE.tryCatch(
          async () => {
            await storage.put('compose_file', composeFile, {
              plan: input.plan,
              content: composeContent,
              services: concepts.map((c) => String(c['name'] ?? c['concept'] ?? 'svc')),
              createdAt: new Date().toISOString(),
            });
            return generateOk(composeFile, files);
          },
          mkError('GENERATE_FAILED'),
        );
      }),
    ),

  /** Diff current compose state against the stored version to compute create/update/delete counts. */
  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compose_file', input.composeFile),
        mkError('COMPOSE_LOOKUP_FAILED'),
      ),
      TE.chain((existing) =>
        pipe(
          TE.tryCatch(
            () => storage.find('applied_services', { composeFile: input.composeFile }),
            mkError('SERVICE_LOOKUP_FAILED'),
          ),
          TE.map((appliedServices) => {
            const desiredServices = (existing as Record<string, unknown> | null)?.['services'] as readonly string[] | undefined ?? [];
            const appliedNames = new Set(appliedServices.map((s) => String(s['name'])));
            const desiredNames = new Set(desiredServices);

            const toCreate = [...desiredNames].filter((n) => !appliedNames.has(n)).length;
            const toDelete = [...appliedNames].filter((n) => !desiredNames.has(n)).length;
            const toUpdate = [...desiredNames].filter((n) => appliedNames.has(n)).length;

            return previewOk(input.composeFile, toCreate, toUpdate, toDelete);
          }),
        ),
      ),
    ),

  /** Apply the compose file: detect port conflicts, then create/update services. */
  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compose_file', input.composeFile),
        mkError('COMPOSE_LOOKUP_FAILED'),
      ),
      TE.chain((composeRecord) =>
        pipe(
          O.fromNullable(composeRecord),
          O.fold(
            () => TE.left<DockerComposeIacProviderError>({
              code: 'COMPOSE_NOT_FOUND',
              message: `Compose file ${input.composeFile} has not been generated`,
            }),
            (record) => {
              const services = (record['services'] as readonly string[] | undefined) ?? [];
              return pipe(
                TE.tryCatch(
                  () => storage.find('applied_services', {}),
                  mkError('SERVICE_LOOKUP_FAILED'),
                ),
                TE.chain((existingServices) => {
                  // Check for port conflicts across all existing services
                  const existingPorts = new Map<number, string>();
                  for (const svc of existingServices) {
                    const svcName = String(svc['name']);
                    const svcCompose = String(svc['composeFile'] ?? '');
                    if (svcCompose !== input.composeFile) {
                      const port = assignPort(svcName, 3000);
                      existingPorts.set(port, svcName);
                    }
                  }

                  for (const svcName of services) {
                    const port = assignPort(String(svcName), 3000);
                    const conflict = existingPorts.get(port);
                    if (conflict) {
                      return TE.right<DockerComposeIacProviderError, DockerComposeIacProviderApplyOutput>(
                        applyPortConflict(port, conflict),
                      );
                    }
                  }

                  const existingNames = new Set(
                    existingServices
                      .filter((s) => String(s['composeFile']) === input.composeFile)
                      .map((s) => String(s['name'])),
                  );

                  const created: string[] = [];
                  const updated: string[] = [];
                  for (const svc of services) {
                    if (existingNames.has(String(svc))) {
                      updated.push(String(svc));
                    } else {
                      created.push(String(svc));
                    }
                  }

                  return TE.tryCatch(
                    async () => {
                      for (const svc of services) {
                        await storage.put('applied_services', String(svc), {
                          name: String(svc),
                          composeFile: input.composeFile,
                          port: assignPort(String(svc), 3000),
                          appliedAt: new Date().toISOString(),
                        });
                      }
                      return applyOk(input.composeFile, created, updated);
                    },
                    mkError('APPLY_FAILED'),
                  );
                }),
              );
            },
          ),
        ),
      ),
    ),

  /** Tear down all services associated with a compose file and clean up stored state. */
  teardown: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('applied_services', { composeFile: input.composeFile }),
        mkError('SERVICE_LOOKUP_FAILED'),
      ),
      TE.chain((services) => {
        const serviceNames = services.map((s) => String(s['name']));

        return TE.tryCatch(
          async () => {
            for (const name of serviceNames) {
              await storage.delete('applied_services', name);
            }
            await storage.delete('compose_file', input.composeFile);
            return teardownOk(input.composeFile, serviceNames);
          },
          mkError('TEARDOWN_FAILED'),
        );
      }),
    ),
};
