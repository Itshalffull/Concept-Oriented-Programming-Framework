// Telemetry Concept Implementation (Deploy Kit)
// Manage observability configuration for deployed concepts.
import type { ConceptHandler } from '@clef/runtime';

export const telemetryHandler: ConceptHandler = {
  async configure(input, storage) {
    const concept = input.concept as string;
    const endpoint = input.endpoint as string;
    const samplingRate = input.samplingRate as number;

    const configId = `tel-${concept}`;

    await storage.put('config', configId, {
      configId,
      endpoint,
      samplingRate,
      serviceName: concept,
      serviceNamespace: 'default',
      serviceVersion: '0.0.0',
      markers: JSON.stringify([]),
    });

    return { variant: 'ok', config: configId };
  },

  async deployMarker(input, storage) {
    const kit = input.kit as string;
    const version = input.version as string;
    const environment = input.environment as string;
    const status = input.status as string;

    const markerId = `marker-${kit}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Find the telemetry config to check if backend is available
    const allConfigs = await storage.find('config');
    if (allConfigs.length === 0) {
      // No telemetry configured, but still store the marker
      await storage.put('config', markerId, {
        configId: markerId,
        endpoint: '',
        samplingRate: 1.0,
        serviceName: kit,
        serviceNamespace: environment,
        serviceVersion: version,
        markers: JSON.stringify([{
          deployId: markerId,
          timestamp,
          kitVersion: version,
        }]),
      });
      return { variant: 'ok', marker: markerId };
    }

    const marker = {
      deployId: markerId,
      timestamp,
      kitVersion: version,
      environment,
      status,
    };

    await storage.put('config', markerId, {
      configId: markerId,
      endpoint: (allConfigs[0].endpoint as string) || '',
      samplingRate: 1.0,
      serviceName: kit,
      serviceNamespace: environment,
      serviceVersion: version,
      markers: JSON.stringify([marker]),
    });

    return { variant: 'ok', marker: markerId };
  },

  async analyze(input, storage) {
    const concept = input.concept as string;
    const window = input.window as number;
    const criteria = input.criteria as string;

    // Find telemetry config for this concept
    const configId = `tel-${concept}`;
    const config = await storage.get('config', configId);

    if (!config) {
      return {
        variant: 'insufficientData',
        concept,
        samplesFound: 0,
        samplesNeeded: 100,
      };
    }

    const endpoint = config.endpoint as string;
    if (!endpoint) {
      return { variant: 'backendUnavailable', endpoint: '' };
    }

    // Parse criteria for thresholds
    let criteriaObj: { maxErrorRate?: number; maxLatencyP99?: number } = {};
    try {
      criteriaObj = JSON.parse(criteria);
    } catch {
      criteriaObj = { maxErrorRate: 0.01, maxLatencyP99: 500 };
    }

    // Simulate metric analysis
    const errorRate = 0.001;
    const latencyP99 = 45;
    const sampleSize = 1000;

    const maxErrorRate = criteriaObj.maxErrorRate ?? 0.01;
    const maxLatencyP99 = criteriaObj.maxLatencyP99 ?? 500;
    const healthy = errorRate <= maxErrorRate && latencyP99 <= maxLatencyP99;

    return {
      variant: 'ok',
      healthy,
      errorRate,
      latencyP99,
      sampleSize,
    };
  },
};
