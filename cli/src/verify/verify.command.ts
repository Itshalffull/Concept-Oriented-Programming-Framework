// Clef Verify — Interactive formal verification CLI
// Orchestrates the CEGIS-based verification flow with work items.
// See Architecture doc Sections 9.1-9.6, 13.1-13.3
//
// DX Tiers:
//   clef verify                     — Tier 3: verify existing manual properties
//   clef verify --synthesize        — Tier 2: LLM-assisted CEGIS + multi-AI + human approval
//   clef verify --status            — Show current verification status
//   clef verify review              — Interactive one-by-one review of pending properties
//   clef verify --approve <prop>    — Approve an AI-validated property (work item)
//   clef verify --reject <prop>     — Reject an AI-validated property (work item)
//   clef verify --list-pending      — List pending work items for human review
//   clef verify --watch             — Watch mode for continuous reverification

import { Command } from 'commander';
import { createInterface } from 'node:readline';

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

// ── clef verify review ───────────────────────────────────────────────
// Interactive one-by-one review of pending properties (like git add -p).
verifyCommand
  .command('review')
  .description(
    'Interactive review of AI-validated properties. Walks through each pending ' +
    'property one at a time showing full context: the property statement, solver ' +
    'result, AI review summaries, and counterexamples. Prompts for approve, ' +
    'reject, request-changes, or skip on each. Like `git add -p` for proofs.'
  )
  .option('--concept <concept>', 'Filter to a specific concept')
  .option('--batch <n>', 'Review at most N properties then stop')
  .action(async (opts) => {
    // Fetch all pending properties (AI-validated, awaiting human approval)
    const pendingResult = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/FormalProperty',
      method: 'listPending',
      target_symbol: opts.concept || '*',
      status: 'ai-validated',
    });

    if (pendingResult.variant !== 'ok') {
      console.error(`Failed to fetch pending properties: ${pendingResult.message || pendingResult.variant}`);
      return;
    }

    const properties: PendingProperty[] = JSON.parse(pendingResult.properties || '[]');

    if (properties.length === 0) {
      console.log('No properties awaiting review.');
      return;
    }

    const limit = opts.batch ? parseInt(opts.batch, 10) : properties.length;
    const toReview = properties.slice(0, limit);

    console.log(`${properties.length} properties pending review${limit < properties.length ? ` (reviewing first ${limit})` : ''}.`);
    console.log('For each property: [a]pprove  [r]eject  [f]eedback  [s]kip  [d]etail  [q]uit');
    console.log('');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const prompt = (question: string): Promise<string> =>
      new Promise((resolve) => rl.question(question, resolve));

    let approved = 0;
    let rejected = 0;
    let feedbackSent = 0;
    let skipped = 0;

    for (let i = 0; i < toReview.length; i++) {
      const prop = toReview[i];

      // ── Render property context ──
      console.log(`─── Property ${i + 1}/${toReview.length} ───────────────────────────────────`);
      console.log(`  ID:       ${prop.id}`);
      console.log(`  Concept:  ${prop.concept}`);
      console.log(`  Kind:     ${prop.kind || 'safety'}`);
      console.log(`  Schema:   ${prop.schema || 'custom'}`);
      console.log('');
      console.log(`  Statement:`);
      console.log(`    ${prop.statement}`);
      console.log('');

      // Show solver result
      if (prop.solver_result) {
        const sr = prop.solver_result;
        const icon = sr.verdict === 'proved' ? '✓' : sr.verdict === 'refuted' ? '✗' : '?';
        console.log(`  Solver:   ${icon} ${sr.verdict} by ${sr.solver} (${sr.duration_ms}ms)`);
        if (sr.counterexample) {
          console.log(`  Counter:  ${sr.counterexample}`);
        }
      }

      // Show AI review summaries
      if (prop.ai_reviews && prop.ai_reviews.length > 0) {
        console.log('  AI Reviews:');
        for (const review of prop.ai_reviews) {
          const icon = review.verdict === 'accept' ? '✓' : review.verdict === 'reject' ? '✗' : '~';
          console.log(`    ${icon} ${review.reviewer}: ${review.verdict} — ${review.summary}`);
          if (review.concerns && review.concerns.length > 0) {
            for (const concern of review.concerns) {
              console.log(`      ! ${concern}`);
            }
          }
        }
      }

      // Show consensus status
      if (prop.consensus) {
        console.log(`  Consensus: ${prop.consensus.status} (${prop.consensus.policy})`);
      }

      console.log('');

      // ── Interactive prompt loop ──
      let decided = false;
      while (!decided) {
        const answer = await prompt(`  [a]pprove  [r]eject  [f]eedback  [s]kip  [d]etail  [q]uit > `);
        const choice = answer.trim().toLowerCase();

        switch (choice) {
          case 'a':
          case 'approve': {
            const result = await globalThis.kernel.handleRequest({
              concept: 'urn:clef/Approval',
              method: 'approve',
              work_item_type: 'property-review',
              entity_ref: prop.id,
              comment: '',
            });
            if (result.variant === 'ok') {
              console.log(`  ✓ Approved. Severity: warn → gate (yellow → green)`);
              approved++;
            } else {
              console.log(`  ✗ Approval failed: ${result.message || result.variant}`);
            }
            decided = true;
            break;
          }

          case 'r':
          case 'reject': {
            const reason = await prompt('  Rejection reason (optional): ');
            const result = await globalThis.kernel.handleRequest({
              concept: 'urn:clef/Approval',
              method: 'reject',
              work_item_type: 'property-review',
              entity_ref: prop.id,
              reason: reason.trim(),
            });
            if (result.variant === 'ok') {
              console.log(`  ✗ Rejected.${reason.trim() ? ` Reason: ${reason.trim()}` : ''}`);
              rejected++;
            } else {
              console.log(`  ✗ Rejection failed: ${result.message || result.variant}`);
            }
            decided = true;
            break;
          }

          case 'f':
          case 'feedback': {
            const feedback = await prompt('  Your feedback: ');
            if (!feedback.trim()) {
              console.log('  (empty feedback, not sent)');
              break;
            }
            // Send feedback as a work item comment — triggers re-synthesis
            const result = await globalThis.kernel.handleRequest({
              concept: 'urn:clef/WorkItem',
              method: 'requestChanges',
              work_item_type: 'property-review',
              entity_ref: prop.id,
              feedback: feedback.trim(),
            });
            if (result.variant === 'ok') {
              console.log(`  → Feedback sent. Property will be re-synthesized with your guidance.`);
              feedbackSent++;
            } else {
              console.log(`  ✗ Feedback failed: ${result.message || result.variant}`);
            }
            decided = true;
            break;
          }

          case 's':
          case 'skip':
            console.log('  — Skipped.');
            skipped++;
            decided = true;
            break;

          case 'd':
          case 'detail': {
            // Fetch full property details including SMTLIB, Dafny source, etc.
            const detail = await globalThis.kernel.handleRequest({
              concept: 'urn:clef/FormalProperty',
              method: 'detail',
              property_id: prop.id,
            });
            if (detail.variant === 'ok') {
              console.log('');
              console.log('  ─── Full Detail ───');
              if (detail.smtlib) {
                console.log('  SMT-LIB:');
                for (const line of (detail.smtlib as string).split('\n')) {
                  console.log(`    ${line}`);
                }
              }
              if (detail.dafny) {
                console.log('  Dafny:');
                for (const line of (detail.dafny as string).split('\n')) {
                  console.log(`    ${line}`);
                }
              }
              if (detail.invariant_ref) {
                console.log(`  Source invariant: ${detail.invariant_ref}`);
              }
              if (detail.synthesis_trace) {
                const trace = JSON.parse(detail.synthesis_trace as string);
                console.log(`  CEGIS iterations: ${trace.length}`);
                for (const step of trace) {
                  console.log(`    ${step.iteration}: ${step.action} — ${step.outcome}`);
                }
              }
              console.log('');
            } else {
              console.log(`  (detail unavailable: ${detail.message || detail.variant})`);
            }
            // Don't set decided — loop back to prompt
            break;
          }

          case 'q':
          case 'quit':
            console.log('');
            console.log(`Review session ended.`);
            printReviewSummary(approved, rejected, feedbackSent, skipped, toReview.length - i - 1);
            rl.close();
            return;

          default:
            console.log('  ? Unknown action. Use: [a]pprove [r]eject [f]eedback [s]kip [d]etail [q]uit');
            break;
        }
      }

      console.log('');
    }

    console.log('Review complete.');
    printReviewSummary(approved, rejected, feedbackSent, skipped, 0);
    rl.close();
  });

// ── clef verify review-counterexamples ───────────────────────────────
// Interactive triage of counterexamples, same one-by-one flow.
verifyCommand
  .command('review-counterexamples')
  .description(
    'Interactive triage of counterexamples. Walks through each counterexample ' +
    'from failed verifications and prompts for classification: handler-bug, ' +
    'spec-error, spurious, or needs-investigation.'
  )
  .option('--concept <concept>', 'Filter to a specific concept')
  .action(async (opts) => {
    const pendingResult = await globalThis.kernel.handleRequest({
      concept: 'urn:clef/WorkItem',
      method: 'listPending',
      work_item_type: 'counterexample-triage',
      entity_ref: opts.concept || '*',
    });

    if (pendingResult.variant !== 'ok') {
      console.error(`Failed to fetch counterexamples: ${pendingResult.message || pendingResult.variant}`);
      return;
    }

    const items: CounterexampleItem[] = JSON.parse(pendingResult.items || '[]');

    if (items.length === 0) {
      console.log('No counterexamples awaiting triage.');
      return;
    }

    console.log(`${items.length} counterexamples to triage.`);
    console.log('For each: [b]ug  [s]pec-error  [p]urious  [i]nvestigate  [d]etail  [q]uit');
    console.log('');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const prompt = (question: string): Promise<string> =>
      new Promise((resolve) => rl.question(question, resolve));

    const triageCounts: Record<string, number> = {
      'handler-bug': 0, 'spec-error': 0, 'spurious': 0, 'investigate': 0, 'skipped': 0,
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      console.log(`─── Counterexample ${i + 1}/${items.length} ─────────────────────────────`);
      console.log(`  ID:        ${item.id}`);
      console.log(`  Property:  ${item.property_ref}`);
      console.log(`  Concept:   ${item.concept}`);
      console.log(`  Solver:    ${item.solver}`);
      console.log('');
      console.log(`  Witness:`);
      if (item.witness) {
        for (const [key, value] of Object.entries(item.witness)) {
          console.log(`    ${key} = ${value}`);
        }
      }
      if (item.trace) {
        console.log(`  Trace:     ${item.trace}`);
      }
      console.log('');

      let decided = false;
      while (!decided) {
        const answer = await prompt(`  [b]ug  [s]pec-error  [p]urious  [i]nvestigate  [d]etail  [q]uit > `);
        const choice = answer.trim().toLowerCase();

        const actionMap: Record<string, string> = {
          b: 'handler-bug', bug: 'handler-bug',
          s: 'spec-error', 'spec-error': 'spec-error',
          p: 'spurious', spurious: 'spurious',
          i: 'investigate', investigate: 'investigate',
        };

        if (choice === 'q' || choice === 'quit') {
          console.log('');
          console.log('Triage session ended.');
          printTriageSummary(triageCounts, items.length - i - 1);
          rl.close();
          return;
        }

        if (choice === 'd' || choice === 'detail') {
          const detail = await globalThis.kernel.handleRequest({
            concept: 'urn:clef/FormalProperty',
            method: 'detail',
            property_id: item.property_ref,
          });
          if (detail.variant === 'ok') {
            console.log('');
            if (detail.statement) console.log(`  Statement: ${detail.statement}`);
            if (detail.smtlib) {
              console.log('  SMT-LIB:');
              for (const line of (detail.smtlib as string).split('\n')) {
                console.log(`    ${line}`);
              }
            }
            console.log('');
          }
          continue;
        }

        const action = actionMap[choice];
        if (!action) {
          console.log('  ? Use: [b]ug [s]pec-error [p]urious [i]nvestigate [d]etail [q]uit');
          continue;
        }

        const comment = await prompt('  Comment (optional): ');
        const result = await globalThis.kernel.handleRequest({
          concept: 'urn:clef/WorkItem',
          method: 'complete',
          work_item_type: 'counterexample-triage',
          entity_ref: item.id,
          action,
          comment: comment.trim(),
        });

        const actionMessages: Record<string, string> = {
          'handler-bug': 'Filed as handler bug.',
          'spec-error': 'Property will be re-synthesized.',
          'spurious': 'Marked spurious.',
          'investigate': 'Escalated.',
        };

        if (result.variant === 'ok') {
          console.log(`  ✓ ${actionMessages[action]}`);
          triageCounts[action]++;
        } else {
          console.log(`  ✗ Failed: ${result.message || result.variant}`);
        }
        decided = true;
      }

      console.log('');
    }

    console.log('Triage complete.');
    printTriageSummary(triageCounts, 0);
    rl.close();
  });

// ── Types for interactive review ─────────────────────────────────────

interface PendingProperty {
  id: string;
  concept: string;
  kind?: string;
  schema?: string;
  statement: string;
  solver_result?: {
    verdict: string;
    solver: string;
    duration_ms: number;
    counterexample?: string;
  };
  ai_reviews?: Array<{
    reviewer: string;
    verdict: string;
    summary: string;
    concerns?: string[];
  }>;
  consensus?: {
    status: string;
    policy: string;
  };
}

interface CounterexampleItem {
  id: string;
  property_ref: string;
  concept: string;
  solver: string;
  witness?: Record<string, unknown>;
  trace?: string;
}

function printReviewSummary(
  approved: number, rejected: number, feedback: number, skipped: number, remaining: number,
): void {
  console.log('');
  console.log('Summary:');
  if (approved > 0) console.log(`  ✓ ${approved} approved`);
  if (rejected > 0) console.log(`  ✗ ${rejected} rejected`);
  if (feedback > 0) console.log(`  → ${feedback} sent back with feedback`);
  if (skipped > 0)  console.log(`  — ${skipped} skipped`);
  if (remaining > 0) console.log(`  … ${remaining} remaining`);
}

function printTriageSummary(counts: Record<string, number>, remaining: number): void {
  console.log('');
  console.log('Summary:');
  if (counts['handler-bug'] > 0) console.log(`  🐛 ${counts['handler-bug']} handler bugs filed`);
  if (counts['spec-error'] > 0)  console.log(`  📝 ${counts['spec-error']} spec errors (re-synthesize)`);
  if (counts['spurious'] > 0)    console.log(`  👻 ${counts['spurious']} spurious`);
  if (counts['investigate'] > 0) console.log(`  🔍 ${counts['investigate']} escalated`);
  if (remaining > 0)             console.log(`  … ${remaining} remaining`);
}

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
    { action: 'review', command: 'review' },
    { action: 'reviewCounterexamples', command: 'review-counterexamples' },
    { action: 'listPending', command: 'list-pending' },
    { action: 'approve', command: 'approve' },
    { action: 'reject', command: 'reject' },
    { action: 'triage', command: 'triage' },
    { action: 'coverage', command: 'coverage' },
    { action: 'watch', command: 'watch' },
  ],
};
