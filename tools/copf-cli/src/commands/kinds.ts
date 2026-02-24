// ============================================================
// copf kinds <subcommand>
//
// Kind system queries — inspect the IR/artifact taxonomy.
//
// Subcommands:
//   copf kinds list                List all registered kinds
//   copf kinds path <from> <to>    Find shortest transform path
//   copf kinds consumers <kind>    What transforms consume this kind
//   copf kinds producers <kind>    What transforms produce this kind
//
// See copf-generation-kit.md Part 6.
// ============================================================

import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { kindSystemHandler } from '../../../../kits/generation/implementations/typescript/kind-system.impl.js';
import type { ConceptStorage } from '../../../../kernel/src/types.js';

// Standard kind taxonomy — registered at query time for CLI display.
// In a full runtime, these would be bootstrapped from kit.yaml.
async function bootstrapStandardKinds(storage: ConceptStorage): Promise<void> {
  // Source kinds
  await kindSystemHandler.define({ name: 'ConceptDSL', category: 'source' }, storage);
  await kindSystemHandler.define({ name: 'SyncDSL', category: 'source' }, storage);
  await kindSystemHandler.define({ name: 'InterfaceManifest', category: 'source' }, storage);
  await kindSystemHandler.define({ name: 'DeployManifest', category: 'source' }, storage);

  // Model kinds
  await kindSystemHandler.define({ name: 'ConceptAST', category: 'model' }, storage);
  await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, storage);
  await kindSystemHandler.define({ name: 'SyncAST', category: 'model' }, storage);
  await kindSystemHandler.define({ name: 'CompiledSync', category: 'model' }, storage);
  await kindSystemHandler.define({ name: 'Projection', category: 'model' }, storage);
  await kindSystemHandler.define({ name: 'DeployPlan', category: 'model' }, storage);

  // Artifact kinds (framework)
  await kindSystemHandler.define({ name: 'TypeScriptFiles', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'RustFiles', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'SwiftFiles', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'SolidityFiles', category: 'artifact' }, storage);

  // Artifact kinds (interface)
  await kindSystemHandler.define({ name: 'RestRoutes', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'GraphqlSchema', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'GrpcServices', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'CliCommands', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'McpTools', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'OpenApiDoc', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'AsyncApiDoc', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'TsSdkPackage', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'PySdkPackage', category: 'artifact' }, storage);

  // Artifact kinds (deploy)
  await kindSystemHandler.define({ name: 'TerraformModule', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'PulumiProgram', category: 'artifact' }, storage);
  await kindSystemHandler.define({ name: 'ArgoApp', category: 'artifact' }, storage);

  // Edges: source → model
  await kindSystemHandler.connect({ from: 'ConceptDSL', to: 'ConceptAST', relation: 'parses_to', transformName: 'SpecParser' }, storage);
  await kindSystemHandler.connect({ from: 'ConceptAST', to: 'ConceptManifest', relation: 'normalizes_to', transformName: 'SchemaGen' }, storage);
  await kindSystemHandler.connect({ from: 'SyncDSL', to: 'SyncAST', relation: 'parses_to', transformName: 'SyncParser' }, storage);
  await kindSystemHandler.connect({ from: 'SyncAST', to: 'CompiledSync', relation: 'normalizes_to', transformName: 'SyncCompiler' }, storage);

  // Edges: model → artifact (framework)
  await kindSystemHandler.connect({ from: 'ConceptManifest', to: 'TypeScriptFiles', relation: 'renders_to', transformName: 'TypeScriptGen' }, storage);
  await kindSystemHandler.connect({ from: 'ConceptManifest', to: 'RustFiles', relation: 'renders_to', transformName: 'RustGen' }, storage);
  await kindSystemHandler.connect({ from: 'ConceptManifest', to: 'SwiftFiles', relation: 'renders_to', transformName: 'SwiftGen' }, storage);
  await kindSystemHandler.connect({ from: 'ConceptManifest', to: 'SolidityFiles', relation: 'renders_to', transformName: 'SolidityGen' }, storage);

  // Edges: model → model (interface)
  await kindSystemHandler.connect({ from: 'ConceptManifest', to: 'Projection', relation: 'normalizes_to', transformName: 'Projection' }, storage);

  // Edges: model → artifact (interface)
  await kindSystemHandler.connect({ from: 'Projection', to: 'RestRoutes', relation: 'renders_to', transformName: 'RestTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'GraphqlSchema', relation: 'renders_to', transformName: 'GraphqlTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'GrpcServices', relation: 'renders_to', transformName: 'GrpcTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'CliCommands', relation: 'renders_to', transformName: 'CliTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'McpTools', relation: 'renders_to', transformName: 'McpTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'OpenApiDoc', relation: 'renders_to', transformName: 'OpenApiTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'AsyncApiDoc', relation: 'renders_to', transformName: 'AsyncApiTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'TsSdkPackage', relation: 'renders_to', transformName: 'TsSdkTarget' }, storage);
  await kindSystemHandler.connect({ from: 'Projection', to: 'PySdkPackage', relation: 'renders_to', transformName: 'PySdkTarget' }, storage);

  // Edges: deploy
  await kindSystemHandler.connect({ from: 'DeployManifest', to: 'DeployPlan', relation: 'normalizes_to', transformName: 'DeployPlan' }, storage);
  await kindSystemHandler.connect({ from: 'DeployPlan', to: 'TerraformModule', relation: 'renders_to', transformName: 'TfProvider' }, storage);
  await kindSystemHandler.connect({ from: 'DeployPlan', to: 'PulumiProgram', relation: 'renders_to', transformName: 'PulumiProvider' }, storage);
  await kindSystemHandler.connect({ from: 'DeployPlan', to: 'ArgoApp', relation: 'renders_to', transformName: 'ArgoProvider' }, storage);
}

export async function kindsCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const subcommand = positional[0];

  switch (subcommand) {
    case 'list':
      await kindsList(flags);
      break;
    case 'path':
      await kindsPath(positional.slice(1), flags);
      break;
    case 'consumers':
      await kindsConsumers(positional.slice(1), flags);
      break;
    case 'producers':
      await kindsProducers(positional.slice(1), flags);
      break;
    default:
      console.error('Usage: copf kinds <list|path|consumers|producers> [args...]');
      console.error('\nSubcommands:');
      console.error('  list                   Show all registered IR/artifact kinds');
      console.error('  path <from> <to>       Find shortest transform path between kinds');
      console.error('  consumers <kind>       What transforms consume this kind');
      console.error('  producers <kind>       What transforms produce this kind');
      process.exit(1);
  }
}

async function kindsList(
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const storage = createInMemoryStorage();
  await bootstrapStandardKinds(storage);

  const result = await kindSystemHandler.graph({}, storage);
  const kinds = (result.kinds as { name: string; category: string }[]) || [];
  const edges = (result.edges as { from: string; to: string; relation: string; transform: string | null }[]) || [];

  console.log('Kind Taxonomy');
  console.log('=============\n');

  // Group by category
  const byCategory: Record<string, string[]> = {};
  for (const k of kinds) {
    if (!byCategory[k.category]) byCategory[k.category] = [];
    byCategory[k.category].push(k.name);
  }

  const categoryOrder = ['source', 'model', 'artifact'];
  for (const cat of categoryOrder) {
    const names = byCategory[cat] || [];
    if (names.length === 0) continue;
    console.log(`  ${cat.toUpperCase()} (${names.length}):`);
    for (const name of names.sort()) {
      console.log(`    ${name}`);
    }
    console.log('');
  }

  console.log(`  Transforms (${edges.length}):`);
  for (const edge of edges) {
    const transform = edge.transform ? ` (${edge.transform})` : '';
    console.log(`    ${edge.from} --${edge.relation}--> ${edge.to}${transform}`);
  }

  console.log(`\n${kinds.length} kind(s), ${edges.length} transform(s)`);
}

async function kindsPath(
  positional: string[],
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const from = positional[0];
  const to = positional[1];
  if (!from || !to) {
    console.error('Usage: copf kinds path <from> <to>');
    process.exit(1);
  }

  const storage = createInMemoryStorage();
  await bootstrapStandardKinds(storage);

  const result = await kindSystemHandler.route({ from, to }, storage);

  if (result.variant === 'unreachable') {
    console.log(`No path from ${from} to ${to}.`);
    return;
  }

  const path = (result.path as { kind: string; relation: string; transform: string | null }[]) || [];

  console.log(`Path from ${from} to ${to}:\n`);
  console.log(`  ${from}`);
  for (const step of path) {
    const transform = step.transform ? ` (${step.transform})` : '';
    console.log(`    --${step.relation}-->${transform}`);
    console.log(`  ${step.kind}`);
  }
  console.log(`\n${path.length} step(s)`);
}

async function kindsConsumers(
  positional: string[],
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const kind = positional[0];
  if (!kind) {
    console.error('Usage: copf kinds consumers <kind>');
    process.exit(1);
  }

  const storage = createInMemoryStorage();
  await bootstrapStandardKinds(storage);

  const result = await kindSystemHandler.consumers({ kind }, storage);
  const transforms = (result.transforms as { toKind: string; transformName: string | null }[]) || [];

  if (transforms.length === 0) {
    console.log(`No transforms consume ${kind}.`);
    return;
  }

  console.log(`Transforms consuming ${kind}:\n`);
  for (const t of transforms) {
    const name = t.transformName || '(unnamed)';
    console.log(`  ${kind} --> ${t.toKind} (${name})`);
  }
}

async function kindsProducers(
  positional: string[],
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const kind = positional[0];
  if (!kind) {
    console.error('Usage: copf kinds producers <kind>');
    process.exit(1);
  }

  const storage = createInMemoryStorage();
  await bootstrapStandardKinds(storage);

  const result = await kindSystemHandler.producers({ kind }, storage);
  const transforms = (result.transforms as { fromKind: string; transformName: string | null }[]) || [];

  if (transforms.length === 0) {
    console.log(`No transforms produce ${kind}.`);
    return;
  }

  console.log(`Transforms producing ${kind}:\n`);
  for (const t of transforms) {
    const name = t.transformName || '(unnamed)';
    console.log(`  ${t.fromKind} --> ${kind} (${name})`);
  }
}
