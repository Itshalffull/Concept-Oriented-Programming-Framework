// Polity Concept Handler
// Establish and manage governance domains with foundational rules.
import type { ConceptHandler } from '@clef/runtime';

export const polityHandler: ConceptHandler = {
  async establish(input, storage) {
    const id = `polity-${Date.now()}`;
    await storage.put('polity', id, {
      id, name: input.name, purpose: input.purpose, scope: input.scope,
      values: input.values, amendmentThreshold: input.amendmentThreshold,
      status: 'Active', establishedAt: new Date().toISOString(),
    });
    return { variant: 'established', polity: id };
  },

  async amend(input, storage) {
    const { polity, field, newValue, proposedBy } = input;
    const record = await storage.get('polity', polity as string);
    if (!record) return { variant: 'not_found', polity };
    await storage.put('polity', polity as string, { ...record, [field as string]: newValue, lastAmendedAt: new Date().toISOString() });
    return { variant: 'amended', polity };
  },

  async dissolve(input, storage) {
    const { polity, reason } = input;
    const record = await storage.get('polity', polity as string);
    if (!record) return { variant: 'not_found', polity };
    await storage.put('polity', polity as string, { ...record, status: 'Dissolved', dissolvedAt: new Date().toISOString(), reason });
    return { variant: 'dissolved', polity };
  },
};
