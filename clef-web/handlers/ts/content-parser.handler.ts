import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const contentParserHandler: ConceptHandler = {
  async parse(input: Record<string, unknown>, storage: ConceptStorage) {
    const { source, format } = input as { source: string; format?: string };

    const id = randomUUID();

    // Extract headings from markdown
    const headings: Array<{ depth: number; text: string; id: string }> = [];
    const lines = source.split('\n');
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const depth = match[1].length;
        const text = match[2];
        const headingId = text
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');
        headings.push({ depth, text, id: headingId });
      }
    }

    // Simple markdown-to-HTML conversion
    const html = source
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');

    await storage.put('parsed_content', id, {
      source,
      html,
      frontmatter: '{}',
      format: format ?? 'markdown',
    });

    return { variant: 'ok', parsed: id, html, frontmatter: '{}', headings };
  },
};
