// Emitter Concept Implementation (Interface Kit)
import type { ConceptHandler } from '@copf/kernel';

function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export const interfaceEmitterHandler: ConceptHandler = {
  async write(input, storage) {
    const path = input.path as string;
    const content = input.content as string;
    const target = input.target as string;
    const concept = input.concept as string;

    // Validate output directory is writable (simulate directory check)
    const dirParts = path.split('/');
    if (dirParts.length < 2) {
      return { variant: 'directoryError', path, reason: 'Invalid output path' };
    }
    const outputDir = dirParts.slice(0, -1).join('/');

    // Content-addressed write: compute hash and check for existing file
    const hash = computeHash(content);
    const existing = await storage.get('file', path);

    if (existing && existing.hash === hash) {
      // Content unchanged, skip write
      return { variant: 'ok', file: path, hash, written: false };
    }

    const now = new Date().toISOString();
    const sizeBytes = new TextEncoder().encode(content).length;

    await storage.put('file', path, {
      path,
      hash,
      target,
      concept,
      generatedAt: now,
      sizeBytes,
      formatted: false,
      content,
    });

    // Update manifest
    const allFiles = await storage.find('file');
    const dirFiles = allFiles.filter((f) => (f.path as string).startsWith(outputDir));
    const totalBytes = dirFiles.reduce((sum, f) => sum + (f.sizeBytes as number), 0);

    await storage.put('manifest', outputDir, {
      outputDir,
      totalFiles: dirFiles.length,
      totalBytes,
    });

    return { variant: 'ok', file: path, hash, written: true };
  },

  async format(input, storage) {
    const file = input.file as string;
    const formatter = input.formatter as string;

    const existing = await storage.get('file', file);
    if (!existing) {
      return { variant: 'formatError', file, reason: 'File not found' };
    }

    // Validate formatter is known
    const knownFormatters = ['prettier', 'black', 'gofmt', 'rustfmt', 'clang-format'];
    if (!knownFormatters.includes(formatter)) {
      return { variant: 'formatterUnavailable', formatter };
    }

    // Simulate formatting (in production, would shell out to formatter binary)
    const content = existing.content as string;
    const formattedContent = content.trim() + '\n';
    const newHash = computeHash(formattedContent);

    await storage.put('file', file, {
      ...existing,
      content: formattedContent,
      hash: newHash,
      formatted: true,
    });

    return { variant: 'ok', file };
  },

  async clean(input, storage) {
    const outputDir = input.outputDir as string;
    const currentFiles = JSON.parse(input.currentFiles as string) as string[];

    const allFiles = await storage.find('file');
    const removed: string[] = [];

    for (const record of allFiles) {
      const filePath = record.path as string;
      if (filePath.startsWith(outputDir) && !currentFiles.includes(filePath)) {
        await storage.del('file', filePath);
        removed.push(filePath);
      }
    }

    // Update manifest
    const remainingFiles = await storage.find('file');
    const dirFiles = remainingFiles.filter((f) => (f.path as string).startsWith(outputDir));
    const totalBytes = dirFiles.reduce((sum, f) => sum + (f.sizeBytes as number), 0);

    await storage.put('manifest', outputDir, {
      outputDir,
      totalFiles: dirFiles.length,
      totalBytes,
    });

    return { variant: 'ok', removed: JSON.stringify(removed) };
  },

  async manifest(input, storage) {
    const outputDir = input.outputDir as string;

    const allFiles = await storage.find('file');
    const dirFiles = allFiles.filter((f) => (f.path as string).startsWith(outputDir));

    const files = dirFiles.map((f) => f.path as string);
    const totalBytes = dirFiles.reduce((sum, f) => sum + (f.sizeBytes as number), 0);

    return { variant: 'ok', files: JSON.stringify(files), totalBytes };
  },
};
