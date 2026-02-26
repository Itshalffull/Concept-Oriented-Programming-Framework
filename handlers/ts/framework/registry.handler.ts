// ============================================================
// Registry Concept Implementation
//
// Tracks deployed concepts, their locations, and availability.
// Stores concept registrations with URIs and transport configs.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';
import { generateId } from '../../../runtime/types.js';

export const registryHandler: ConceptHandler = {
  async register(input, storage) {
    const uri = input.uri as string;
    const transport = input.transport as Record<string, unknown>;

    // Check for duplicate URI
    const existing = await storage.find('concepts', { uri });
    if (existing.length > 0) {
      return { variant: 'error', message: `Concept already registered: ${uri}` };
    }

    const conceptId = generateId();

    // Store in the "concepts" set
    await storage.put('concepts', conceptId, { conceptId, uri });

    // Store URI mapping
    await storage.put('uri', conceptId, { conceptId, uri });

    // Store transport config
    await storage.put('transport', conceptId, {
      conceptId,
      ...(transport || {}),
    });

    // Mark as available
    await storage.put('available', conceptId, { conceptId, available: true });

    return { variant: 'ok', concept: conceptId };
  },

  async deregister(input, storage) {
    const uri = input.uri as string;

    // Find the concept by URI
    const matches = await storage.find('concepts', { uri });
    if (matches.length > 0) {
      const conceptId = matches[0].conceptId as string;
      await storage.del('concepts', conceptId);
      await storage.del('uri', conceptId);
      await storage.del('transport', conceptId);
      await storage.del('available', conceptId);
    }

    return { variant: 'ok' };
  },

  async heartbeat(input, storage) {
    const uri = input.uri as string;

    // Find the concept by URI and check availability
    const matches = await storage.find('concepts', { uri });
    if (matches.length === 0) {
      return { variant: 'ok', available: false };
    }

    const conceptId = matches[0].conceptId as string;
    const avail = await storage.get('available', conceptId);
    const available = avail ? (avail.available as boolean) : false;

    return { variant: 'ok', available };
  },
};
