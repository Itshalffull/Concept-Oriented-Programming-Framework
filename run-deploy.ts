// End-to-end deploy: boot kernel, then deploy all clef-* apps
import { kernelBootHandler } from './handlers/ts/framework/kernel-boot.handler.js';
import { createInMemoryStorage } from './runtime/adapters/storage.js';

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         Clef Deploy — Full Pipeline Test        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Step 1: Boot the kernel (loads .env, discovers handlers, compiles syncs)
  console.log('[1] Booting kernel...');
  const bootStorage = createInMemoryStorage();
  const bootResult = await kernelBootHandler.boot({ projectRoot: '.' }, bootStorage);

  console.log(`    Variant: ${bootResult.variant}`);
  console.log(`    Concepts: ${((bootResult.concepts as string[]) || []).length}`);
  console.log(`    Syncs: ${((bootResult.syncs as string[]) || []).length}`);

  if (bootResult.variant !== 'ok' && bootResult.variant !== 'syncCompilationFailed') {
    console.error('    Kernel boot failed, aborting deploy.');
    process.exit(1);
  }

  // Verify VERCEL_TOKEN loaded
  if (!process.env.VERCEL_TOKEN) {
    console.error('\n    ERROR: VERCEL_TOKEN not found in .env or environment.');
    console.error('    Add it to .env: VERCEL_TOKEN=your-token-here');
    process.exit(1);
  }
  console.log(`    VERCEL_TOKEN: ${process.env.VERCEL_TOKEN.slice(0, 8)}...`);
  console.log(`    VERCEL_TEAM_ID: ${process.env.VERCEL_TEAM_ID || '(not set)'}`);

  // Step 2: Get the kernel from globalThis
  const kernel = (globalThis as Record<string, unknown>).kernel as any;
  if (!kernel) {
    console.error('\n    ERROR: globalThis.kernel not set after boot.');
    process.exit(1);
  }

  // Step 3: Deploy all apps via DeployOrchestrator
  console.log('\n[2] Deploying all clef-* apps...');
  const deployResult = await kernel.invokeConcept(
    'urn:clef/DeployOrchestrator',
    'deployAll',
    { projectRoot: '.', environment: 'production' },
  );

  console.log(`\n    Deploy result: ${deployResult.variant}`);

  if (deployResult.variant === 'ok') {
    const deployed = (deployResult.deployed as string[]) || [];
    const urls = (deployResult.urls as string[]) || [];
    const failed = (deployResult.failed as string[]) || [];

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║              Deployment Summary                  ║');
    console.log('╚══════════════════════════════════════════════════╝');

    for (let i = 0; i < deployed.length; i++) {
      console.log(`  ✓ ${deployed[i]} → ${urls[i]}`);
    }
    for (const f of failed) {
      console.log(`  ✗ ${f} — FAILED`);
    }

    const configuredApps = (deployResult.configuredApps as string[]) || [];
    if (configuredApps.length > 0) {
      console.log('\n  Cross-app dependencies configured:');
      for (const app of configuredApps) {
        console.log(`  ⟂ ${app}`);
      }
    }

    console.log(`\n  ${deployed.length} deployed, ${failed.length} failed, ${configuredApps.length} configured`);
  } else {
    console.error(`\n  Deploy failed: ${JSON.stringify(deployResult)}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
