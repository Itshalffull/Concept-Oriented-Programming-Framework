import { interfaceCommand } from '../cli/src/commands/interface.ts';
await interfaceCommand(['generate'], { manifest: 'examples/devtools/devtools.interface.yaml' });
console.log('Done');
