import { syncEntityHandler } from './handlers/ts/score/sync-entity.handler.ts';
import { interpret } from './runtime/interpreter.ts';
import { createInMemoryStorage } from './runtime/in-memory-storage.ts';

const storage = createInMemoryStorage();
const r1 = await interpret(syncEntityHandler.register({ name: 'ArticlePublishSync', source: 'syncs/article-publish.sync', compiled: JSON.stringify({when:[{concept:'Article',action:'publish'}],then:[{concept:'Search',action:'index'}]}) }), storage);
process.stdout.write('register: ' + r1.variant + '\n');
const r2 = await interpret(syncEntityHandler.findByConcept({ concept: 'NonexistentConcept' }), storage);
process.stdout.write('findByConcept: ' + r2.variant + '\n');
