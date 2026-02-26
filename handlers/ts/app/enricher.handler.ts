// Enricher Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const enricherHandler: ConceptHandler = {
  async enrich(input, storage) {
    const itemId = input.itemId as string;
    const enricherId = input.enricherId as string;

    const trigger = await storage.get('enricherTrigger', enricherId);
    if (!trigger) {
      return { variant: 'notfound', message: `Enricher "${enricherId}" not found` };
    }

    // Plugin-dispatched to enricher_plugin provider
    const enrichmentId = `enr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const enrichment = {
      enrichmentId,
      itemId,
      pluginId: trigger.pluginId,
      result: '{}',
      confidence: '0.0',
      status: 'suggested',
      generatedAt: new Date().toISOString(),
    };

    await storage.put('enrichment', enrichmentId, enrichment);

    return {
      variant: 'ok',
      enrichmentId,
      result: enrichment.result,
      confidence: enrichment.confidence,
    };
  },

  async suggest(input, storage) {
    const itemId = input.itemId as string;

    // Run all applicable enrichers and collect suggestions
    const triggers = await storage.find('enricherTrigger');
    const suggestions: any[] = [];

    for (const trigger of triggers) {
      const enrichmentId = `enr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const enrichment = {
        enrichmentId,
        itemId,
        pluginId: trigger.pluginId,
        result: '{}',
        confidence: '0.0',
        status: 'suggested',
        generatedAt: new Date().toISOString(),
      };
      await storage.put('enrichment', enrichmentId, enrichment);
      suggestions.push(enrichment);
    }

    return { variant: 'ok', suggestions: JSON.stringify(suggestions) };
  },

  async accept(input, storage) {
    const itemId = input.itemId as string;
    const enrichmentId = input.enrichmentId as string;

    const enrichment = await storage.get('enrichment', enrichmentId);
    if (!enrichment) {
      return { variant: 'notfound', message: `Enrichment "${enrichmentId}" not found` };
    }

    await storage.put('enrichment', enrichmentId, {
      ...enrichment,
      status: 'accepted',
    });

    return { variant: 'ok' };
  },

  async reject(input, storage) {
    const itemId = input.itemId as string;
    const enrichmentId = input.enrichmentId as string;

    const enrichment = await storage.get('enrichment', enrichmentId);
    if (!enrichment) {
      return { variant: 'notfound', message: `Enrichment "${enrichmentId}" not found` };
    }

    await storage.put('enrichment', enrichmentId, {
      ...enrichment,
      status: 'rejected',
    });

    return { variant: 'ok' };
  },

  async refreshStale(input, storage) {
    const olderThan = input.olderThan as string;
    const allEnrichments = await storage.find('enrichment');

    let refreshed = 0;
    for (const enrichment of allEnrichments) {
      if (enrichment.status === 'accepted' || enrichment.status === 'suggested') {
        const generatedAt = new Date(enrichment.generatedAt as string).getTime();
        const threshold = Date.now() - parseInt(olderThan, 10) * 1000;
        if (generatedAt < threshold) {
          await storage.put('enrichment', enrichment.enrichmentId as string, {
            ...enrichment,
            status: 'stale',
          });
          refreshed++;
        }
      }
    }

    return { variant: 'ok', refreshed };
  },
};
