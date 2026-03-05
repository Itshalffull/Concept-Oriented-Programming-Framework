import { conceptLibraryTargetHandler } from '../handlers/ts/app/concept-library-target.handler.js';
import { uiLibraryTargetHandler } from '../handlers/ts/app/ui-library-target.handler.js';
import { writeFileSync } from 'fs';

// Minimal in-memory storage for standalone execution
function makeStorage() {
  const data = new Map<string, Record<string, unknown>>();
  return {
    async put(rel: string, key: string, val: Record<string, unknown>) {
      data.set(`${rel}:${key}`, val);
    },
    async get(rel: string, key: string) {
      return data.get(`${rel}:${key}`) || null;
    },
    async find(_rel: string, _criteria?: Record<string, unknown>) {
      return [] as Record<string, unknown>[];
    },
    async del(_rel: string, _key: string) {},
    async delMany(_rel: string, _criteria: Record<string, unknown>) {
      return 0;
    },
    _data: data,
  };
}

async function main() {
  // Generate concept library
  console.log('=== ConceptLibraryTarget.generate ===');
  const clStorage = makeStorage();
  const clResult = await conceptLibraryTargetHandler.generate(
    { config: JSON.stringify({ outputPath: 'docs/reference/concept-library.md' }) },
    clStorage,
  );
  console.log('Variant:', clResult.variant);
  console.log('Files:', clResult.files);

  // Find the stored doc
  let clContent = '';
  for (const [key, val] of clStorage._data) {
    if (key.startsWith('document:') && val.content) {
      clContent = val.content as string;
    }
  }
  if (clContent) {
    writeFileSync('docs/reference/concept-library.md', clContent);
    console.log(`Wrote concept-library.md (${clContent.split('\n').length} lines)\n`);
  } else {
    console.error('No content generated for concept-library.md');
  }

  // Generate UI library
  console.log('=== UILibraryTarget.generate ===');
  const uiStorage = makeStorage();
  const uiResult = await uiLibraryTargetHandler.generate(
    { config: JSON.stringify({ outputPath: 'docs/reference/ui-library.md' }) },
    uiStorage,
  );
  console.log('Variant:', uiResult.variant);
  console.log('Files:', uiResult.files);

  let uiContent = '';
  for (const [key, val] of uiStorage._data) {
    if (key.startsWith('document:') && val.content) {
      uiContent = val.content as string;
    }
  }
  if (uiContent) {
    writeFileSync('docs/reference/ui-library.md', uiContent);
    console.log(`Wrote ui-library.md (${uiContent.split('\n').length} lines)`);
  } else {
    console.error('No content generated for ui-library.md');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
