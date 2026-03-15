// Clef Verify — Interactive formal verification CLI
// Orchestrates the CEGIS-based verification flow with work items.
// See Architecture doc Sections 9.1-9.6, 13.1-13.3
//
// DX Tiers:
//   clef verify                     — Tier 3: verify existing manual properties
//   clef verify --synthesize        — Tier 2: LLM-assisted CEGIS + multi-AI + human approval
//   clef verify --status            — Show current verification status
//   clef verify --approve <prop>    — Approve an AI-validated property (work item)
//   clef verify --reject <prop>     — Reject an AI-validated property (work item)
//   clef verify --list-pending      — List pending work items for human review
//   clef verify --watch             — Watch mode for continuous reverification

import { Command } from 'commander';

export const verifyCommand = new Command('verify')
  .description(
    'Formal verification of concept properties. Runs solver-backed verification, ' +
    'CEGIS-based property synthesis, multi-AI review, and human approval workflows.'
  );

// ── clef verify run ──────────────────────────────────────────────────
// Tier 3: Verify existing manually-written properties for a concept.
verifyCommand
  .command('run')
  .description(
    'Verify existing formal properties for a concept. Dispatches to solvers ' +
    'via the solver escalation chain (Z3 → CVC5 → Alloy → Dafny+LLM). ' +
    'Reports proved/refuted/unknown status per property.'
  )
  .requiredOption('--concept <concept>', 'Target concept symbol (e.g., clef/concept/Password)')
  .option('--property <property>', 'Verify a single property by ID')
  .option('--solver <solver>', 'Force a specific solver (z3, cvc5, alloy, dafny, path-b)', 'auto')
  .option('--timeout <ms>', 'Solver timeout in milliseconds', '5000')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const result = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/VerificationRun',
      method: 'start',
      target_symbol: opts.concept,
      properties_filter: opts.property || null,
      solver: opts.solver,
      timeout_ms: parseInt(opts.timeout, 10),
    });

    if (opts.json) {
      console.log(JSON.stringify(result));
      return;
    }

    if (result.variant === 'ok') {
      console.log(`Verification run started: ${result.run_ref}`);
      console.log(`  Target: ${opts.concept}`);
      console.log(`  Solver: ${opts.solver}`);

      // Poll for completion via QualitySignal
      const status = await globalThis.kernel.handleRequest({
        concept: 'urn:clef/QualitySignal',
        method: 'explain',
        target_symbol: opts.concept,
        dimensions: JSON.stringify(['formal', 'formal-liveness']),
      });

      if (status.variant === 'ok') {
        const contributors = JSON.parse(status.contributors || '[]');
        for (const c of contributors) {
          const icon = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '?';
          console.log(`  ${icon} ${c.dimension}: ${c.status} (${c.severity}) — ${c.summary || ''}`);
        }
      }
    } else {
      console.error(`Verification failed: ${result.message || result.variant}`);
    }
  });

// ── clef verify synthesize ───────────────────────────────────────────
// Tier 2: LLM-assisted CEGIS property synthesis + multi-AI review.
verifyCommand
  .command('synthesize')
  .description(
    'Synthesize formal properties from concept intent using CEGIS loop. ' +
    'Claude generates properties, solver verifies, two independent AIs review, ' +
    'developer approves. AI-validated properties appear yellow in Score until ' +
    'human-approved (green).'
  )
  .requiredOption('--concept <concept>', 'Target concept symbol')
  .option('--max-iterations <n>', 'Max CEGIS iterations per property', '5')
  .option('--consensus <policy>', 'AI consensus policy: unanimous | majority | any-two', 'unanimous')
  .option('--auto-approve', 'Skip human approval (properties stay at warn severity)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    // Step 1: Trigger property synthesis via FormalProperty/synthesize
    const synthResult = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/FormalProperty',
      method: 'synthesize',
      target_symbol: opts.concept,
      intent_ref: opts.concept,
    });

    if (opts.json) {
      console.log(JSON.stringify(synthResult));
      return;
    }

    if (synthResult.variant === 'ok') {
      const properties = JSON.parse(synthResult.properties || '[]');
      console.log(`Synthesized ${properties.length} properties for ${opts.concept}`);

      // The property-synthesis-starts-process sync will automatically
      // trigger the ProcessRun for property-synthesis-and-validation,
      // which includes:
      //   1. CEGIS refinement loop
      //   2. Solver consistency check
      //   3. Multi-AI review (fork: ChatGPT + Gemini)
      //   4. Consensus check
      //   5. Human approval gate (unless --auto-approve)

      console.log('');
      console.log('Workflow started: property-synthesis-and-validation');
      console.log('  Steps: synthesize → solver-check → AI review (2x) → consensus → human approval');
      console.log('');

      // Show current status
      for (const prop of properties) {
        console.log(`  → ${prop}: synthesized (awaiting solver check)`);
      }

      if (!opts.autoApprove) {
        console.log('');
        console.log('Use `clef verify list-pending` to see properties awaiting approval.');
        console.log('Use `clef verify approve --property <id>` to approve.');
      }
    } else {
      console.error(`Synthesis failed: ${synthResult.message || synthResult.variant}`);
    }
  });

// ── clef verify status ───────────────────────────────────────────────
verifyCommand
  .command('status')
  .description(
    'Show current verification status for a concept or all concepts. ' +
    'Displays proof coverage, quality signal dimensions, and pending work items.'
  )
  .option('--concept <concept>', 'Target concept (omit for all)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    if (opts.concept) {
      // Single concept status
      const [coverage, quality] = await Promise.all([
        globalThis.kernel.handleRequest({
          concept: 'urn:clef/FormalProperty',
          method: 'coverage',
          target_symbol: opts.concept,
        }),
        globalThis.kernel.handleRequest({
          concept: 'urn:clef/QualitySignal',
          method: 'explain',
          target_symbol: opts.concept,
        }),
      ]);

      if (opts.json) {
        console.log(JSON.stringify({ coverage, quality }));
        return;
      }

      console.log(`Verification status: ${opts.concept}`);
      if (coverage.variant === 'ok') {
        const pct = coverage.coverage_pct || 0;
        const bar = '█'.repeat(Math.round(pct / 6.25)) + '░'.repeat(16 - Math.round(pct / 6.25));
        console.log(`  Proof coverage: ${bar} ${pct.toFixed(1)}%`);
        console.log(`    proved: ${coverage.proved}  refuted: ${coverage.refuted}  unknown: ${coverage.unknown}  timeout: ${coverage.timeout}`);
      }

      if (quality.variant === 'ok') {
        const contributors = JSON.parse(quality.contributors || '[]');
        console.log('  Quality signals:');
        for (const c of contributors) {
          const icon = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : c.status === 'warn' ? '⚠' : '?';
          const color = c.severity === 'gate' ? '' : ` (${c.severity})`;
          console.log(`    ${icon} ${c.dimension}: ${c.status}${color}`);
        }
      }
    } else {
      // All concepts rollup
      const rollup = await globalThis.kernel.handleRequest({
        concept: 'urn:clef/QualitySignal',
        method: 'rollup',
        target_symbols: JSON.stringify(['*']),
        dimensions: JSON.stringify(['formal', 'conformance', 'property-test', 'surface-fsm', 'surface-a11y']),
      });

      if (opts.json) {
        console.log(JSON.stringify(rollup));
        return;
      }

      if (rollup.variant === 'ok') {
        const results = JSON.parse(rollup.results || '[]');
        for (const r of results) {
          const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '?';
          const block = r.blocking ? ' [BLOCKING]' : '';
          console.log(`  ${icon} ${r.target}: ${r.status}${block}`);
        }
      }
    }
  });

// ── clef verify list-pending ─────────────────────────────────────────
// List work items awaiting human approval in the verification workflow.
verifyCommand
  .command('list-pending')
  .description(
    'List AI-validated properties awaiting human approval. These are properties ' +
    'that passed CEGIS synthesis, solver consistency check, and multi-AI review ' +
    'but have not yet been approved by a developer (yellow in Score).'
  )
  .option('--concept <concept>', 'Filter by concept')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    // Query FormalProperty for properties in "ai-validated" status
    // (status = proved, severity = warn — not yet human-approved)
    const signals = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/QualitySignal',
      method: 'explain',
      target_symbol: opts.concept || '*',
      dimensions: JSON.stringify(['formal']),
    });

    if (opts.json) {
      console.log(JSON.stringify(signals));
      return;
    }

    if (signals.variant === 'ok') {
      const contributors = JSON.parse(signals.contributors || '[]');
      const pending = contributors.filter((c: any) => c.severity === 'warn' && c.status === 'warn');

      if (pending.length === 0) {
        console.log('No properties awaiting approval.');
        return;
      }

      console.log(`${pending.length} properties awaiting human approval:`);
      console.log('');
      for (const p of pending) {
        console.log(`  ⚠ ${p.run_ref || 'unknown'}`);
        console.log(`    Target: ${p.dimension}`);
        console.log(`    Summary: ${p.summary || 'AI-validated property'}`);
        console.log(`    Observed: ${p.observed_at}`);
        console.log('');
      }
      console.log('Use `clef verify approve --property <id>` to approve.');
      console.log('Use `clef verify reject --property <id>` to reject.');
    }
  });

// ── clef verify approve ──────────────────────────────────────────────
// Approve an AI-validated property (human gate in the workflow).
verifyCommand
  .command('approve')
  .description(
    'Approve an AI-validated property. Upgrades it from warn/yellow to ' +
    'gate/green severity in QualitySignal. This completes the human-review ' +
    'step in the property-synthesis-and-validation workflow.'
  )
  .requiredOption('--property <property>', 'Property ID to approve')
  .option('--comment <comment>', 'Optional approval comment')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const result = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/Approval',
      method: 'approve',
      work_item_type: 'property-review',
      entity_ref: opts.property,
      comment: opts.comment || '',
    });

    if (opts.json) {
      console.log(JSON.stringify(result));
      return;
    }

    if (result.variant === 'ok') {
      console.log(`✓ Property ${opts.property} approved.`);
      console.log('  Severity upgraded: warn → gate (yellow → green)');
      // The human-approval-upgrades-property sync will fire automatically
    } else {
      console.error(`Approval failed: ${result.message || result.variant}`);
    }
  });

// ── clef verify reject ───────────────────────────────────────────────
verifyCommand
  .command('reject')
  .description(
    'Reject an AI-validated property. Removes it from the verification set. ' +
    'Optionally provide a reason for the rejection.'
  )
  .requiredOption('--property <property>', 'Property ID to reject')
  .option('--reason <reason>', 'Rejection reason')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const result = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/Approval',
      method: 'reject',
      work_item_type: 'property-review',
      entity_ref: opts.property,
      reason: opts.reason || '',
    });

    if (opts.json) {
      console.log(JSON.stringify(result));
      return;
    }

    if (result.variant === 'ok') {
      console.log(`✗ Property ${opts.property} rejected.`);
      if (opts.reason) {
        console.log(`  Reason: ${opts.reason}`);
      }
    } else {
      console.error(`Rejection failed: ${result.message || result.variant}`);
    }
  });

// ── clef verify triage ───────────────────────────────────────────────
// Triage a counterexample from the investigation workflow.
verifyCommand
  .command('triage')
  .description(
    'Triage a counterexample from the investigation workflow. ' +
    'Classify as handler-bug, spec-error, spurious, or needs-investigation.'
  )
  .requiredOption('--evidence <evidence>', 'Evidence/counterexample ID')
  .requiredOption('--action <action>', 'Triage action: handler-bug | spec-error | spurious | investigate')
  .option('--comment <comment>', 'Triage comment')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const validActions = ['handler-bug', 'spec-error', 'spurious', 'investigate'];
    if (!validActions.includes(opts.action)) {
      console.error(`Invalid action "${opts.action}". Valid: ${validActions.join(', ')}`);
      process.exit(1);
    }

    const result = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/WorkItem',
      method: 'complete',
      work_item_type: 'counterexample-triage',
      entity_ref: opts.evidence,
      action: opts.action,
      comment: opts.comment || '',
    });

    if (opts.json) {
      console.log(JSON.stringify(result));
      return;
    }

    if (result.variant === 'ok') {
      const actionMessages: Record<string, string> = {
        'handler-bug': 'Filed as handler bug fix task.',
        'spec-error': 'Property will be re-synthesized.',
        'spurious': 'Marked as spurious solver artifact.',
        'investigate': 'Escalated for investigation.',
      };
      console.log(`✓ Counterexample ${opts.evidence} triaged: ${opts.action}`);
      console.log(`  ${actionMessages[opts.action]}`);
    } else {
      console.error(`Triage failed: ${result.message || result.variant}`);
    }
  });

// ── clef verify coverage ─────────────────────────────────────────────
verifyCommand
  .command('coverage')
  .description(
    'Show proof and test coverage for a concept. Includes formal property ' +
    'coverage and generated test coverage across all languages.'
  )
  .requiredOption('--concept <concept>', 'Target concept symbol')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const [proofCoverage, testCoverage] = await Promise.all([
      globalThis.kernel.handleRequest({
        concept: 'urn:clef/FormalProperty',
        method: 'coverage',
        target_symbol: opts.concept,
      }),
      globalThis.kernel.handleRequest({
        concept: 'urn:clef/TestGen',
        method: 'coverage',
        concept_ref: opts.concept,
      }),
    ]);

    if (opts.json) {
      console.log(JSON.stringify({ proof: proofCoverage, test: testCoverage }));
      return;
    }

    console.log(`Coverage: ${opts.concept}`);
    console.log('');

    if (proofCoverage.variant === 'ok') {
      const pct = proofCoverage.coverage_pct || 0;
      const bar = '█'.repeat(Math.round(pct / 6.25)) + '░'.repeat(16 - Math.round(pct / 6.25));
      console.log(`  Formal: ${bar} ${pct.toFixed(1)}%`);
      console.log(`    ${proofCoverage.proved} proved, ${proofCoverage.refuted} refuted, ${proofCoverage.unknown} unknown, ${proofCoverage.timeout} timeout`);
    }

    if (testCoverage.variant === 'ok') {
      const pct = testCoverage.coverage_pct || 0;
      const bar = '█'.repeat(Math.round(pct / 6.25)) + '░'.repeat(16 - Math.round(pct / 6.25));
      const langs = JSON.parse(testCoverage.languages || '[]');
      console.log(`  Tests:  ${bar} ${pct.toFixed(1)}%`);
      console.log(`    ${testCoverage.covered}/${testCoverage.total_invariants} invariants covered across [${langs.join(', ')}]`);
    }
  });

// ── clef verify watch ────────────────────────────────────────────────
verifyCommand
  .command('watch')
  .description(
    'Watch mode: continuously re-verify on spec changes. Triggers the ' +
    'reverification cascade ProcessSpec when changes are detected.'
  )
  .option('--concept <concept>', 'Watch specific concept (omit for all)')
  .option('--budget <ms>', 'Time budget per reverification cycle in milliseconds', '300000')
  .action(async (opts) => {
    console.log(`Watching for changes${opts.concept ? ` to ${opts.concept}` : ''}...`);
    console.log(`  Budget: ${opts.budget}ms per cycle`);
    console.log('  Press Ctrl+C to stop.');
    console.log('');

    // The actual watch loop would be driven by the Resource/track sync
    // and the change-starts-reverification sync triggering ProcessRun.
    // This command sets up the watch configuration and starts listening.
    const result = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/Resource',
      method: 'watch',
      pattern: opts.concept ? `specs/**/${opts.concept}.concept` : 'specs/**/*.concept',
      on_change: 'reverification-cascade',
      budget_ms: parseInt(opts.budget, 10),
    });

    if (result.variant === 'ok') {
      console.log('Watch started. Reverification will trigger on spec changes.');
    } else {
      console.error(`Watch setup failed: ${result.message || result.variant}`);
    }
  });

export const verifyCommandTree = {
  group: 'verify',
  description: 'Formal verification: CEGIS property synthesis, solver dispatch, multi-AI review, human approval',
  commands: [
    { action: 'run', command: 'run' },
    { action: 'synthesize', command: 'synthesize' },
    { action: 'status', command: 'status' },
    { action: 'listPending', command: 'list-pending' },
    { action: 'approve', command: 'approve' },
    { action: 'reject', command: 'reject' },
    { action: 'triage', command: 'triage' },
    { action: 'coverage', command: 'coverage' },
    { action: 'watch', command: 'watch' },
  ],
};
