import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const contentNodeHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug, content } = input;
    const source = content as string;
    // Simple markdown to HTML conversion
    const html = source
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
    await storage.put('nodes', slug as string, {
      slug: slug as string,
      content: source,
      html,
    });
    return { variant: 'ok', node: slug as string };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug } = input;
    const node = await storage.get('nodes', slug as string);
    if (!node) return { variant: 'notfound' };
    return { variant: 'ok', node: node.slug as string, html: node.html as string };
  },
};
