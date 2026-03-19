// Echo Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const echoHandler: ConceptHandler = {
  async send(input, storage) {
    const id = input.id as string;
    const text = input.text as string;
    await storage.put('echo', id, { text });
    return { variant: 'ok', id, echo: text };
  },
};
