import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const contentParserHandler: ConceptHandler = {
  async parse(input: Record<string, unknown>, storage: ConceptStorage) {
    const { source } = input;
    const id = randomUUID();
    const text = source as string;
    const html = text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
    await storage.put('parsed', id, { source: text, html });
    return { variant: 'ok', parsed: id, html };
  },
};
