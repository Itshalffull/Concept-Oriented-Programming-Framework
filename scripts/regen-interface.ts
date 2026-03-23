import { interfaceCommand } from '../cli/src/commands/interface.ts';
console.error('Starting interface generation...');
try {
  await interfaceCommand(['generate'], { manifest: 'examples/devtools/devtools.interface.yaml' });
  console.error('Interface generation complete');
} catch (e) {
  console.error('Error:', e);
}
