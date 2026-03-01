// Telemetry concept handler — metrics collection with configuration, deploy markers,
// and health analysis. Validates sampling rates, computes aggregated metrics from
// stored event data, and enforces minimum sample size thresholds.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TelemetryStorage,
  TelemetryConfigureInput,
  TelemetryConfigureOutput,
  TelemetryDeployMarkerInput,
  TelemetryDeployMarkerOutput,
  TelemetryAnalyzeInput,
  TelemetryAnalyzeOutput,
} from './types.js';

import {
  configureOk,
  deployMarkerOk,
  deployMarkerBackendUnavailable,
  analyzeOk,
  analyzeInsufficientData,
  analyzeBackendUnavailable,
} from './types.js';

export interface TelemetryError {
  readonly code: string;
  readonly message: string;
}

export interface TelemetryHandler {
  readonly configure: (
    input: TelemetryConfigureInput,
    storage: TelemetryStorage,
  ) => TE.TaskEither<TelemetryError, TelemetryConfigureOutput>;
  readonly deployMarker: (
    input: TelemetryDeployMarkerInput,
    storage: TelemetryStorage,
  ) => TE.TaskEither<TelemetryError, TelemetryDeployMarkerOutput>;
  readonly analyze: (
    input: TelemetryAnalyzeInput,
    storage: TelemetryStorage,
  ) => TE.TaskEither<TelemetryError, TelemetryAnalyzeOutput>;
}

// --- Pure helpers ---

const MIN_SAMPLING_RATE = 0;
const MAX_SAMPLING_RATE = 1;
const MIN_SAMPLES_NEEDED = 10;

const clampSamplingRate = (rate: number): number =>
  Math.max(MIN_SAMPLING_RATE, Math.min(MAX_SAMPLING_RATE, rate));

const isValidEndpoint = (endpoint: string): boolean =>
  endpoint.trim().length > 0;

const generateConfigId = (concept: string): string =>
  `config_${concept}`;

const generateMarkerId = (kit: string, version: string, env: string): string =>
  `marker_${kit}_${version}_${env}_${Date.now().toString(36)}`;

const toStorageError = (error: unknown): TelemetryError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const telemetryHandler: TelemetryHandler = {
  configure: (input, storage) => {
    if (!isValidEndpoint(input.endpoint)) {
      return TE.left({
        code: 'INVALID_ENDPOINT',
        message: 'Telemetry endpoint must not be empty',
      });
    }

    const normalizedRate = clampSamplingRate(input.samplingRate);

    return pipe(
      TE.tryCatch(
        async () => {
          const configId = generateConfigId(input.concept);
          const now = new Date().toISOString();

          await storage.put('telemetry_config', configId, {
            concept: input.concept,
            endpoint: input.endpoint.trim(),
            samplingRate: normalizedRate,
            configuredAt: now,
          });

          return configureOk(configId);
        },
        toStorageError,
      ),
    );
  },

  deployMarker: (input, storage) =>
    pipe(
      // Look up the config for endpoint validation
      TE.tryCatch(
        () => storage.get('telemetry_config', generateConfigId(input.kit)),
        toStorageError,
      ),
      TE.chain((config) =>
        pipe(
          O.fromNullable(config),
          O.fold(
            // No config found, but we can still record the marker locally
            () =>
              TE.tryCatch(
                async () => {
                  const markerId = generateMarkerId(
                    input.kit,
                    input.version,
                    input.environment,
                  );
                  const now = new Date().toISOString();

                  await storage.put('telemetry_marker', markerId, {
                    kit: input.kit,
                    version: input.version,
                    environment: input.environment,
                    status: input.status,
                    createdAt: now,
                  });

                  return deployMarkerOk(markerId);
                },
                toStorageError,
              ),
            (found) => {
              const endpoint = typeof found['endpoint'] === 'string'
                ? found['endpoint'] as string
                : '';

              // Simulate backend availability check based on endpoint reachability
              if (endpoint.length === 0) {
                return TE.right(deployMarkerBackendUnavailable(endpoint));
              }

              return TE.tryCatch(
                async () => {
                  const markerId = generateMarkerId(
                    input.kit,
                    input.version,
                    input.environment,
                  );
                  const now = new Date().toISOString();

                  await storage.put('telemetry_marker', markerId, {
                    kit: input.kit,
                    version: input.version,
                    environment: input.environment,
                    status: input.status,
                    endpoint,
                    createdAt: now,
                  });

                  return deployMarkerOk(markerId);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  analyze: (input, storage) =>
    pipe(
      // Load the telemetry config for this concept
      TE.tryCatch(
        () => storage.get('telemetry_config', generateConfigId(input.concept)),
        toStorageError,
      ),
      TE.chain((config) =>
        pipe(
          O.fromNullable(config),
          O.fold(
            // No config means no backend configured
            () =>
              TE.right(analyzeBackendUnavailable('no-endpoint-configured')),
            (found) => {
              const endpoint = typeof found['endpoint'] === 'string'
                ? found['endpoint'] as string
                : '';

              if (endpoint.length === 0) {
                return TE.right(analyzeBackendUnavailable(endpoint));
              }

              // Query events within the analysis window
              return pipe(
                TE.tryCatch(
                  () => storage.find('telemetry_event', { concept: input.concept }),
                  toStorageError,
                ),
                TE.chain((events) => {
                  const now = Date.now();
                  const windowMs = input.window * 1000;

                  // Filter events within the time window
                  const windowedEvents = events.filter((e) => {
                    const ts = typeof e['timestamp'] === 'number'
                      ? e['timestamp'] as number
                      : 0;
                    return now - ts <= windowMs;
                  });

                  const sampleSize = windowedEvents.length;

                  if (sampleSize < MIN_SAMPLES_NEEDED) {
                    return TE.right(
                      analyzeInsufficientData(
                        input.concept,
                        sampleSize,
                        MIN_SAMPLES_NEEDED,
                      ),
                    );
                  }

                  // Compute metrics from events
                  const errorCount = windowedEvents.filter(
                    (e) => e['error'] === true,
                  ).length;
                  const errorRate = errorCount / sampleSize;

                  // Compute p99 latency
                  const latencies = windowedEvents
                    .map((e) =>
                      typeof e['latencyMs'] === 'number'
                        ? (e['latencyMs'] as number)
                        : 0,
                    )
                    .sort((a, b) => a - b);
                  const p99Index = Math.floor(latencies.length * 0.99);
                  const latencyP99 =
                    latencies.length > 0 ? latencies[Math.min(p99Index, latencies.length - 1)] : 0;

                  // Determine health based on criteria thresholds
                  const healthy = errorRate < 0.05 && latencyP99 < 5000;

                  return TE.right(
                    analyzeOk(healthy, errorRate, latencyP99, sampleSize),
                  );
                }),
              );
            },
          ),
        ),
      ),
    ),
};
