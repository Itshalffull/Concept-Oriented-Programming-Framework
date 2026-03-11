import type { ConceptHandler, ConceptStorage } from '../../runtime/types';
import { createHash, randomUUID } from 'crypto';

export const publisherHandler: ConceptHandler = {
  async package(input: Record<string, unknown>, storage: ConceptStorage) {
    const source_path = input.source_path as string;
    const kind = input.kind as string;
    const manifest = (input.manifest as string) ?? '';

    const id = randomUUID();
    const hash = createHash('sha256').update(`${source_path}:${manifest}`).digest('hex');

    await storage.put('publications', id, {
      id,
      source_path,
      kind,
      artifact_hash: `sha256:${hash}`,
      uploaded: false,
    });

    return { variant: 'ok', publication: id };
  },

  async upload(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;

    const pub = await storage.get('publications', publication);
    if (!pub) return { variant: 'error', message: 'Publication not found' };

    await storage.put('publications', publication, { ...pub, uploaded: true });
    return { variant: 'ok' };
  },

  async attest(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;
    const builder = input.builder as string;
    const source_repo = input.source_repo as string;
    const source_commit = input.source_commit as string;

    const pub = await storage.get('publications', publication);
    if (!pub) return { variant: 'error', message: 'Publication not found' };

    await storage.put('publications', publication, {
      ...pub,
      attestation: JSON.stringify({ builder, source_repo, source_commit }),
    });
    return { variant: 'ok' };
  },

  async generateSbom(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;

    const pub = await storage.get('publications', publication);
    if (!pub) return { variant: 'error', message: 'Publication not found' };

    await storage.put('publications', publication, {
      ...pub,
      sbom: JSON.stringify({ format: 'spdx', generated: new Date().toISOString() }),
    });
    return { variant: 'ok' };
  },

  async sign(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;

    const pub = await storage.get('publications', publication);
    if (!pub) return { variant: 'error', message: 'Publication not found' };

    const signature = createHash('sha256').update(pub.artifact_hash as string).digest('hex');
    await storage.put('publications', publication, { ...pub, signature });
    return { variant: 'ok' };
  },
};
