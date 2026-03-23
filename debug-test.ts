import { flakyTestHandler } from './handlers/ts/framework/test/flaky-test.handler.ts';
import { interpret } from './runtime/interpreter.ts';
import { createInMemoryStorage } from './runtime/adapters/storage.ts';

const storage = createInMemoryStorage();
const result = await interpret(flakyTestHandler.isQuarantined({ testId: 'test_never_seen' }), storage);
console.log('variant:', result.variant);
console.log('output:', JSON.stringify(result.output));
