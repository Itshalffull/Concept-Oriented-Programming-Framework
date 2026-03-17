import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

export const programAnalysisHandler: ConceptHandler = {
  async registerProvider(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const kind = input.kind as string;

    const existing = await storage.get('providers', name);
    if (existing) return { variant: 'exists' };

    await storage.put('providers', name, { kind, registeredAt: new Date().toISOString() });
    return { variant: 'ok' };
  },

  async run(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const provider = input.provider as string;

    const prov = await storage.get('providers', provider);
    if (!prov) return { variant: 'providerNotFound' };

    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = JSON.stringify({ provider, program, analyzedAt: new Date().toISOString() });

    await storage.put('results', analysisId, { program, provider, result });
    return { variant: 'ok', analysis: analysisId, result };
  },

  async runAll(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const providers = await storage.find('providers');
    const results: Record<string, string> = {};

    for (const prov of providers) {
      const name = prov.name as string || (prov as Record<string, unknown>).kind as string;
      results[name] = JSON.stringify({ provider: name, program, analyzedAt: new Date().toISOString() });
    }

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  async listProviders(input: Record<string, unknown>, storage: ConceptStorage) {
    const providers = await storage.find('providers');
    return { variant: 'ok', providers: JSON.stringify(providers) };
  },
};
