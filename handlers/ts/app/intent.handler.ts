import type { ConceptHandler } from '@clef/kernel';

export const intentHandler: ConceptHandler = {
  async define(input, storage) {
    const intent = input.intent as string;
    const target = input.target as string;
    const purpose = input.purpose as string;
    const operationalPrinciple = input.operationalPrinciple as string;
    const existing = await storage.get('intent', intent);
    if (existing) return { variant: 'exists', message: 'already exists' };
    const now = new Date().toISOString();
    await storage.put('intent', intent, {
      intent,
      target,
      purpose,
      operationalPrinciple,
      assertions: JSON.stringify([]),
      createdAt: now,
      updatedAt: now,
    });
    return { variant: 'ok', intent };
  },

  async update(input, storage) {
    const intent = input.intent as string;
    const purpose = input.purpose as string;
    const operationalPrinciple = input.operationalPrinciple as string;
    const existing = await storage.get('intent', intent);
    if (!existing) return { variant: 'notfound', message: 'Intent not found' };
    await storage.put('intent', intent, {
      ...existing,
      purpose,
      operationalPrinciple,
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', intent };
  },

  async verify(input, storage) {
    const intent = input.intent as string;
    const existing = await storage.get('intent', intent);
    if (!existing) return { variant: 'notfound', message: 'Intent not found' };
    const assertions: Array<{ description: string; passed: boolean }> = JSON.parse(
      existing.assertions as string
    );
    const failures: string[] = [];
    let valid = true;
    for (const assertion of assertions) {
      if (!assertion.passed) {
        valid = false;
        failures.push(assertion.description);
      }
    }
    return { variant: 'ok', valid, failures: JSON.stringify(failures) };
  },

  async discover(input, storage) {
    const query = input.query as string;
    const results = await storage.find('intent', query);
    const matches = Array.isArray(results) ? results : [];
    return { variant: 'ok', matches: JSON.stringify(matches) };
  },

  async suggestFromDescription(input, storage) {
    const description = input.description as string;
    const words = description.split(/\s+/);
    const suggested = {
      name: words.slice(0, 3).join(''),
      purpose: description,
      actions: ['create', 'get', 'update', 'delete'],
      state: words
        .filter((w) => w.length > 4)
        .slice(0, 5)
        .map((w) => w.toLowerCase()),
    };
    return { variant: 'ok', suggested: JSON.stringify(suggested) };
  },
};
