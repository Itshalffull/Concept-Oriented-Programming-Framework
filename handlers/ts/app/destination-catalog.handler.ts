import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

async function listDestinationRecords(storage: ConceptStorage): Promise<Array<Record<string, unknown>>> {
  return storage.find('destination', {});
}

function matchesHref(candidate: string, href: string): boolean {
  return candidate === href || href.startsWith(`${candidate}/`);
}

function toDestinationResult(record: Record<string, unknown>) {
  return {
    destination: record.id,
    name: record.name,
    targetConcept: record.targetConcept,
    targetView: record.targetView,
    href: record.href,
    icon: record.icon,
    group: record.group,
  };
}

export const destinationCatalogHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const destination = String(input.destination ?? '');
    const name = String(input.name ?? '');
    const targetConcept = String(input.targetConcept ?? '');
    const targetView = String(input.targetView ?? '');
    const href = String(input.href ?? '');
    const icon = String(input.icon ?? '');
    const group = String(input.group ?? '');

    const existing = await listDestinationRecords(storage);
    const duplicate = existing.find((record) =>
      record.id === destination || record.name === name || record.href === href,
    );
    if (duplicate) {
      return {
        variant: 'duplicate',
        message: `Destination "${name || href || destination}" already exists`,
      };
    }

    await storage.put('destination', destination, {
      id: destination,
      name,
      targetConcept,
      targetView,
      href,
      icon,
      group,
    });

    return { variant: 'ok', destination };
  },

  async resolveByName(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = String(input.name ?? '');
    const destinations = await storage.find('destination', { name });
    const match = destinations[0];
    if (!match) {
      return { variant: 'notfound', message: `Destination "${name}" not found` };
    }

    return { variant: 'ok', ...toDestinationResult(match) };
  },

  async resolveByHref(input: Record<string, unknown>, storage: ConceptStorage) {
    const href = String(input.href ?? '');
    const destinations = await listDestinationRecords(storage);
    const match = destinations.find((record) => matchesHref(String(record.href ?? ''), href));
    if (!match) {
      return { variant: 'notfound', message: `No destination matches "${href}"` };
    }

    return { variant: 'ok', ...toDestinationResult(match) };
  },

  async list(_input: Record<string, unknown>, storage: ConceptStorage) {
    const destinations = await listDestinationRecords(storage);
    return { variant: 'ok', destinations: destinations.map((record) => toDestinationResult(record)) };
  },
};

export default destinationCatalogHandler;
