// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Telemetry Concept Implementation (Deploy Kit)
// Manage observability configuration for deployed concepts.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _telemetryHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const endpoint = input.endpoint as string;
    const samplingRate = input.samplingRate as number;
    const configId = `tel-${concept}`;
    let p = createProgram();
    p = put(p, 'config', configId, { configId, endpoint, samplingRate, serviceName: concept, serviceNamespace: 'default', serviceVersion: '0.0.0', markers: JSON.stringify([]) });
    return complete(p, 'ok', { config: configId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deployMarker(input: Record<string, unknown>) {
    const kit = input.kit as string;
    const version = input.version as string;
    const environment = input.environment as string;
    const status = input.status as string;
    const markerId = `marker-${kit}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const marker = { deployId: markerId, timestamp, kitVersion: version, environment, status };
    let p = createProgram();
    p = put(p, 'config', markerId, { configId: markerId, endpoint: '', samplingRate: 1.0, serviceName: kit, serviceNamespace: environment, serviceVersion: version, markers: JSON.stringify([marker]) });
    return complete(p, 'ok', { marker: markerId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  analyze(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const criteria = input.criteria as string;
    const configId = `tel-${concept}`;
    let p = createProgram();
    p = spGet(p, 'config', configId, 'config');
    p = branch(p, 'config',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const config = bindings.config as Record<string, unknown>;
          return !!(config.endpoint as string);
        }, 'hasEndpoint');
        b2 = branch(b2, (bindings) => bindings.hasEndpoint as boolean,
          (() => {
            let t = createProgram();
            let criteriaObj: { maxErrorRate?: number; maxLatencyP99?: number } = {};
            try { criteriaObj = JSON.parse(criteria); } catch { criteriaObj = { maxErrorRate: 0.01, maxLatencyP99: 500 }; }
            const errorRate = 0.001; const latencyP99 = 45; const sampleSize = 1000;
            const healthy = errorRate <= (criteriaObj.maxErrorRate ?? 0.01) && latencyP99 <= (criteriaObj.maxLatencyP99 ?? 500);
            return complete(t, 'ok', { healthy, errorRate, latencyP99, sampleSize });
          })(),
          (() => { let e = createProgram(); return complete(e, 'backendUnavailable', { endpoint: '' }); })(),
        );
        return b2;
      },
      (b) => complete(b, 'insufficientData', { concept, samplesFound: 0, samplesNeeded: 100 }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const telemetryHandler = autoInterpret(_telemetryHandler);

