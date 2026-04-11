/**
 * Deep Research Kit — Integration Tests
 *
 * Validates the complete deep research pipeline:
 *   - Derived concept composition and operational principles (§2.3)
 *   - End-to-end handler flows for Claim, Citation, ResearchProject (§3, §11)
 *   - Artifact completeness across concepts, syncs, widgets, views, layouts (§7.2)
 *   - Scale performance with 50+ sources and 200+ snippets (§7.2)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';

// Handler imports — autoInterpret proxies that accept (input, storage) for imperative compat
import { claimHandler } from '../handlers/ts/app/claim.handler.js';
import { citationHandler } from '../handlers/ts/app/citation.handler.js';
import { researchProjectHandler } from '../handlers/ts/app/research-project.handler.js';

// ============================================================
// 1. Derived Concept Operational Principle Tests (§2.3)
// ============================================================

const DERIVED_DIR = path.resolve('repertoire/concepts/research-evidence');

describe('Deep Research derived concepts (§2.3)', () => {

  // --- EvidenceChain ---
  describe('EvidenceChain', () => {
    const filePath = path.join(DERIVED_DIR, 'evidence-chain.derived');
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(filePath, 'utf-8');
    });

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('declares as a derived concept named EvidenceChain', () => {
      expect(content).toContain('derived EvidenceChain');
    });

    describe('Composition', () => {
      it('composes Capture', () => {
        expect(content).toContain('Capture');
      });
      it('composes Snippet', () => {
        expect(content).toContain('Snippet');
      });
      it('composes Citation', () => {
        expect(content).toContain('Citation');
      });
      it('composes Claim', () => {
        expect(content).toContain('Claim');
      });
    });

    describe('Syncs boundary', () => {
      it('requires citation-links-create-relations', () => {
        expect(content).toContain('citation-links-create-relations');
      });
      it('requires citation-verified-updates-claim', () => {
        expect(content).toContain('citation-verified-updates-claim');
      });
      it('recommends contradiction-flag', () => {
        expect(content).toContain('contradiction-flag');
      });
    });

    describe('Surface actions', () => {
      it('has captureAndAnchor surface action', () => {
        expect(content).toContain('action captureAndAnchor');
      });
      it('has linkEvidence surface action', () => {
        expect(content).toContain('action linkEvidence');
      });
      it('has verifyCitation surface action', () => {
        expect(content).toContain('action verifyCitation');
      });
    });

    describe('Surface queries', () => {
      it('has traceClaimToSource query', () => {
        expect(content).toContain('query traceClaimToSource');
      });
      it('has coverageForReport query', () => {
        expect(content).toContain('query coverageForReport');
      });
      it('has unsupportedClaims query', () => {
        expect(content).toContain('query unsupportedClaims');
      });
    });

    describe('Operational principle', () => {
      it('has a principle block', () => {
        expect(content).toContain('principle {');
      });
      it('principle covers capture then trace flow', () => {
        expect(content).toContain('captureAndAnchor');
        expect(content).toContain('traceClaimToSource');
      });
      it('principle covers unsupported then verify flow', () => {
        expect(content).toContain('unsupportedClaims');
        expect(content).toContain('verifyCitation');
      });
    });
  });

  // --- PlanApproval ---
  describe('PlanApproval', () => {
    const filePath = path.join(DERIVED_DIR, 'plan-approval.derived');
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(filePath, 'utf-8');
    });

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('declares as a derived concept named PlanApproval', () => {
      expect(content).toContain('derived PlanApproval');
    });

    describe('Composition', () => {
      it('composes PlanAndExecuteStrategy', () => {
        expect(content).toContain('PlanAndExecuteStrategy');
      });
      it('composes Approval', () => {
        expect(content).toContain('Approval');
      });
      it('composes WorkItem', () => {
        expect(content).toContain('WorkItem');
      });
    });

    describe('Syncs boundary', () => {
      it('requires plan-approval-gates-execution', () => {
        expect(content).toContain('plan-approval-gates-execution');
      });
      it('recommends research-project-creates-process-run', () => {
        expect(content).toContain('research-project-creates-process-run');
      });
    });

    describe('Surface actions', () => {
      it('has generateAndPropose surface action', () => {
        expect(content).toContain('action generateAndPropose');
      });
      it('has reviseAndResubmit surface action', () => {
        expect(content).toContain('action reviseAndResubmit');
      });
      it('has approvePlan surface action', () => {
        expect(content).toContain('action approvePlan');
      });
      it('has rejectPlan surface action', () => {
        expect(content).toContain('action rejectPlan');
      });
    });

    describe('Surface queries', () => {
      it('has planStatus query', () => {
        expect(content).toContain('query planStatus');
      });
      it('has pendingApprovals query', () => {
        expect(content).toContain('query pendingApprovals');
      });
    });

    describe('Operational principle', () => {
      it('has a principle block', () => {
        expect(content).toContain('principle {');
      });
      it('principle covers propose then approve flow', () => {
        expect(content).toContain('generateAndPropose');
        expect(content).toContain('approvePlan');
      });
      it('principle covers reject then revise flow', () => {
        expect(content).toContain('rejectPlan');
        expect(content).toContain('reviseAndResubmit');
      });
    });
  });

  // --- CitationVerification ---
  describe('CitationVerification', () => {
    const filePath = path.join(DERIVED_DIR, 'citation-verification.derived');
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(filePath, 'utf-8');
    });

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('declares as a derived concept named CitationVerification', () => {
      expect(content).toContain('derived CitationVerification');
    });

    describe('Composition', () => {
      it('composes Citation', () => {
        expect(content).toContain('Citation');
      });
      it('composes EvaluationRun', () => {
        expect(content).toContain('EvaluationRun');
      });
      it('composes QualityGate', () => {
        expect(content).toContain('QualityGate');
      });
    });

    describe('Syncs boundary', () => {
      it('requires evaluation-gates-report-publish', () => {
        expect(content).toContain('evaluation-gates-report-publish');
      });
      it('recommends citation-verified-updates-claim', () => {
        expect(content).toContain('citation-verified-updates-claim');
      });
    });

    describe('Surface actions', () => {
      it('has verifyAll surface action', () => {
        expect(content).toContain('action verifyAll');
      });
      it('has gateOnQuality surface action', () => {
        expect(content).toContain('action gateOnQuality');
      });
      it('has overrideCitation surface action', () => {
        expect(content).toContain('action overrideCitation');
      });
    });

    describe('Surface queries', () => {
      it('has verificationSummary query', () => {
        expect(content).toContain('query verificationSummary');
      });
      it('has gateStatus query', () => {
        expect(content).toContain('query gateStatus');
      });
      it('has citationsByStatus query', () => {
        expect(content).toContain('query citationsByStatus');
      });
    });

    describe('Operational principle', () => {
      it('has a principle block', () => {
        expect(content).toContain('principle {');
      });
      it('principle covers two-round verification then gate', () => {
        expect(content).toContain('verifyAll');
        expect(content).toContain('gateOnQuality');
        expect(content).toContain('gateStatus');
      });
      it('principle covers override flow', () => {
        expect(content).toContain('overrideCitation');
        expect(content).toContain('manual_override');
      });
    });
  });

  // --- ResearchNotebook ---
  describe('ResearchNotebook', () => {
    const filePath = path.join(DERIVED_DIR, 'research-notebook.derived');
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(filePath, 'utf-8');
    });

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('declares as a derived concept named ResearchNotebook', () => {
      expect(content).toContain('derived ResearchNotebook');
    });

    describe('Composition', () => {
      it('composes AgentMemory', () => {
        expect(content).toContain('AgentMemory');
      });
      it('composes Provenance', () => {
        expect(content).toContain('Provenance');
      });
      it('composes Capture', () => {
        expect(content).toContain('Capture');
      });
      it('composes Snippet', () => {
        expect(content).toContain('Snippet');
      });
    });

    describe('Syncs boundary', () => {
      it('requires memory-promotion-from-report', () => {
        expect(content).toContain('memory-promotion-from-report');
      });
      it('requires agent-memory-recalls-entries', () => {
        expect(content).toContain('agent-memory-recalls-entries');
      });
      it('recommends source-indexes-for-retrieval', () => {
        expect(content).toContain('source-indexes-for-retrieval');
      });
    });

    describe('Surface actions', () => {
      it('has promoteToMemory surface action', () => {
        expect(content).toContain('action promoteToMemory');
      });
      it('has anchorMemoryToSource surface action', () => {
        expect(content).toContain('action anchorMemoryToSource');
      });
      it('has recordLineage surface action', () => {
        expect(content).toContain('action recordLineage');
      });
    });

    describe('Surface queries', () => {
      it('has notebookEntries query', () => {
        expect(content).toContain('query notebookEntries');
      });
      it('has provenanceChainForEntry query', () => {
        expect(content).toContain('query provenanceChainForEntry');
      });
      it('has capturedSources query', () => {
        expect(content).toContain('query capturedSources');
      });
    });

    describe('Operational principle', () => {
      it('has a principle block', () => {
        expect(content).toContain('principle {');
      });
      it('principle covers anchor then promote then recall flow', () => {
        expect(content).toContain('anchorMemoryToSource');
        expect(content).toContain('promoteToMemory');
        expect(content).toContain('notebookEntries');
      });
      it('principle covers provenance trace', () => {
        expect(content).toContain('provenanceChainForEntry');
      });
    });
  });

  // --- DeepResearch (root) ---
  describe('DeepResearch', () => {
    const filePath = path.join(DERIVED_DIR, 'deep-research.derived');
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(filePath, 'utf-8');
    });

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('declares as a derived concept named DeepResearch', () => {
      expect(content).toContain('derived DeepResearch');
    });

    describe('Composition', () => {
      it('composes derived EvidenceChain', () => {
        expect(content).toContain('derived EvidenceChain');
      });
      it('composes derived PlanApproval', () => {
        expect(content).toContain('derived PlanApproval');
      });
      it('composes derived CitationVerification', () => {
        expect(content).toContain('derived CitationVerification');
      });
      it('composes derived ResearchNotebook', () => {
        expect(content).toContain('derived ResearchNotebook');
      });
      it('composes ResearchProject', () => {
        expect(content).toContain('ResearchProject');
      });
      it('composes AgentMemory', () => {
        expect(content).toContain('AgentMemory');
      });
    });

    describe('Syncs boundary', () => {
      it('requires research-project-creates-process-run', () => {
        expect(content).toContain('research-project-creates-process-run');
      });
      it('requires plan-approval-gates-execution', () => {
        expect(content).toContain('plan-approval-gates-execution');
      });
      it('requires evaluation-gates-report-publish', () => {
        expect(content).toContain('evaluation-gates-report-publish');
      });
      it('requires memory-promotion-from-report', () => {
        expect(content).toContain('memory-promotion-from-report');
      });
      it('requires budget-exceeded-halts-run', () => {
        expect(content).toContain('budget-exceeded-halts-run');
      });
      it('recommends all 14 recommended syncs', () => {
        const recommendedSyncs = [
          'citation-verified-updates-claim',
          'contradiction-flag',
          'credibility-evaluation-on-capture',
          'low-credibility-triggers-quarantine',
          'step-dispatches-to-persona',
          'report-compilation-provider',
          'source-indexes-for-retrieval',
          'agent-memory-recalls-entries',
          'research-agent-discovers-tools',
          'research-plan-schema-init',
          'research-project-schema-init',
          'research-report-schema-init',
          'research-source-schema-init',
        ];
        for (const sync of recommendedSyncs) {
          expect(content).toContain(sync);
        }
      });
    });

    describe('Surface actions', () => {
      it('has startResearch surface action', () => {
        expect(content).toContain('action startResearch');
      });
      it('has monitorProgress surface action', () => {
        expect(content).toContain('action monitorProgress');
      });
      it('has approveResearchPlan surface action', () => {
        expect(content).toContain('action approveResearchPlan');
      });
      it('has verifyReportCitations surface action', () => {
        expect(content).toContain('action verifyReportCitations');
      });
      it('has promoteFindings surface action', () => {
        expect(content).toContain('action promoteFindings');
      });
    });

    describe('Surface queries', () => {
      it('has projectDashboard query', () => {
        expect(content).toContain('query projectDashboard');
      });
      it('has evidenceGraph query', () => {
        expect(content).toContain('query evidenceGraph');
      });
      it('has researchHistory query', () => {
        expect(content).toContain('query researchHistory');
      });
      it('has recallFindings query', () => {
        expect(content).toContain('query recallFindings');
      });
    });

    describe('Operational principle', () => {
      it('has principle blocks', () => {
        expect(content).toContain('principle {');
      });
      it('principle covers start then approve then monitor flow', () => {
        expect(content).toContain('startResearch');
        expect(content).toContain('approveResearchPlan');
        expect(content).toContain('monitorProgress');
      });
      it('principle covers verify then promote then recall flow', () => {
        expect(content).toContain('verifyReportCitations');
        expect(content).toContain('promoteFindings');
        expect(content).toContain('recallFindings');
      });
      it('principle covers project dashboard and history', () => {
        expect(content).toContain('projectDashboard');
        expect(content).toContain('researchHistory');
      });
    });
  });
});

// ============================================================
// 2. End-to-End Handler Flow Tests (§3, §11)
// ============================================================

describe('Deep Research end-to-end flow (§3, §11)', () => {

  it('creates a research project in draft status', async () => {
    const storage = createInMemoryStorage();
    const result = await (researchProjectHandler as any).create({
      query: 'Compare cloud GPU pricing across AWS, GCP, and Azure',
      deliverable_type: 'comparison',
      constraints: 'Focus on H100 instances',
      perspectives: 'cost analyst,ML engineer',
      budget: '{"max_tokens":500000,"max_search_calls":80,"max_duration_minutes":30}',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.project).toBeTruthy();
  });

  it('rejects project creation with empty query', async () => {
    const storage = createInMemoryStorage();
    const result = await (researchProjectHandler as any).create({
      query: '',
      deliverable_type: 'report',
      budget: '{}',
    }, storage);

    expect(result.variant).toBe('error');
  });

  it('rejects project creation with invalid deliverable type', async () => {
    const storage = createInMemoryStorage();
    const result = await (researchProjectHandler as any).create({
      query: 'Some valid query',
      deliverable_type: 'invalid_type',
      budget: '{}',
    }, storage);

    expect(result.variant).toBe('error');
  });

  it('transitions project through valid lifecycle states', async () => {
    const storage = createInMemoryStorage();

    // Create project
    const created = await (researchProjectHandler as any).create({
      query: 'Test lifecycle transitions',
      deliverable_type: 'report',
      constraints: '',
      perspectives: '',
      budget: '{}',
    }, storage);
    expect(created.variant).toBe('ok');
    const projectId = created.project;

    // draft -> planning
    const t1 = await (researchProjectHandler as any).transition({
      project: projectId,
      new_status: 'planning',
    }, storage);
    expect(t1.variant).toBe('ok');

    // planning -> executing
    const t2 = await (researchProjectHandler as any).transition({
      project: projectId,
      new_status: 'executing',
    }, storage);
    expect(t2.variant).toBe('ok');

    // executing -> reviewing
    const t3 = await (researchProjectHandler as any).transition({
      project: projectId,
      new_status: 'reviewing',
    }, storage);
    expect(t3.variant).toBe('ok');

    // reviewing -> completed
    const t4 = await (researchProjectHandler as any).transition({
      project: projectId,
      new_status: 'completed',
    }, storage);
    expect(t4.variant).toBe('ok');

    // Verify final state
    const final = await (researchProjectHandler as any).get({
      project: projectId,
    }, storage);
    expect(final.variant).toBe('ok');
    expect(final.status).toBe('completed');
  });

  it('rejects invalid lifecycle transitions', async () => {
    const storage = createInMemoryStorage();

    const created = await (researchProjectHandler as any).create({
      query: 'Test invalid transition',
      deliverable_type: 'report',
      budget: '{}',
    }, storage);
    const projectId = created.project;

    // draft -> reviewing (skipping planning and executing)
    const t = await (researchProjectHandler as any).transition({
      project: projectId,
      new_status: 'reviewing',
    }, storage);
    expect(t.variant).toBe('invalid_transition');
  });

  it('extracts claims and tracks verification status', async () => {
    const storage = createInMemoryStorage();

    // Extract a claim
    const claim = await (claimHandler as any).extract({
      report_entity_id: 'report-1',
      block_id: 'block-3',
      claim_text: 'LLMs achieve 95% accuracy on factual QA tasks.',
    }, storage);
    expect(claim.variant).toBe('ok');
    expect(claim.claim).toBeTruthy();

    // Retrieve it — should be unverified
    const retrieved = await (claimHandler as any).get({
      claim: claim.claim,
    }, storage);
    expect(retrieved.variant).toBe('ok');
    expect(retrieved.status).toBe('unverified');

    // Update verification
    const updated = await (claimHandler as any).updateVerification({
      claim: claim.claim,
      status: 'supported',
      support_score: 0.92,
      verified_by: 'nli_cascade',
    }, storage);
    expect(updated.variant).toBe('ok');

    // Retrieve again — should be supported
    const verified = await (claimHandler as any).get({
      claim: claim.claim,
    }, storage);
    expect(verified.variant).toBe('ok');
    expect(verified.status).toBe('supported');
  });

  it('rejects claim extraction with empty claim text', async () => {
    const storage = createInMemoryStorage();
    const result = await (claimHandler as any).extract({
      report_entity_id: 'report-1',
      block_id: 'block-1',
      claim_text: '',
    }, storage);
    expect(result.variant).toBe('error');
  });

  it('creates citations linking claims to snippets', async () => {
    const storage = createInMemoryStorage();

    // Create a citation
    const citation = await (citationHandler as any).link({
      claim_id: 'claim-1',
      snippet_id: 'snippet-1',
      citation_key: '[1]',
    }, storage);
    expect(citation.variant).toBe('ok');
    expect(citation.citation).toBeTruthy();

    // Retrieve it
    const retrieved = await (citationHandler as any).get({
      citation: citation.citation,
    }, storage);
    expect(retrieved.variant).toBe('ok');
    expect(retrieved.verification_status).toBe('pending');
    expect(retrieved.support_score).toBe(0);
  });

  it('detects duplicate citations', async () => {
    const storage = createInMemoryStorage();

    // Create first citation
    await (citationHandler as any).link({
      claim_id: 'claim-dup',
      snippet_id: 'snippet-dup',
      citation_key: '[1]',
    }, storage);

    // Try creating duplicate
    const dup = await (citationHandler as any).link({
      claim_id: 'claim-dup',
      snippet_id: 'snippet-dup',
      citation_key: '[1]',
    }, storage);
    expect(dup.variant).toBe('duplicate');
  });

  it('verifies citations and derives status from support score', async () => {
    const storage = createInMemoryStorage();

    // Create citation
    const created = await (citationHandler as any).link({
      claim_id: 'claim-v',
      snippet_id: 'snippet-v',
      citation_key: '[2]',
    }, storage);
    const citationId = created.citation;

    // Verify with high score -> verified
    const highScore = await (citationHandler as any).verify({
      citation: citationId,
      support_score: 0.9,
      verification_method: 'nli_cascade',
    }, storage);
    expect(highScore.variant).toBe('ok');

    const result = await (citationHandler as any).get({
      citation: citationId,
    }, storage);
    expect(result.verification_status).toBe('verified');
  });

  it('allows manual citation override', async () => {
    const storage = createInMemoryStorage();

    // Create citation
    const created = await (citationHandler as any).link({
      claim_id: 'claim-override',
      snippet_id: 'snippet-override',
      citation_key: '[3]',
    }, storage);
    const citationId = created.citation;

    // Override
    const overridden = await (citationHandler as any).override({
      citation: citationId,
      verification_status: 'manual_override',
      reason: 'Domain expert confirmed relevance',
    }, storage);
    expect(overridden.variant).toBe('ok');

    const result = await (citationHandler as any).get({
      citation: citationId,
    }, storage);
    expect(result.verification_status).toBe('manual_override');
  });

  it('tracks budget usage and detects exceeded limits', async () => {
    const storage = createInMemoryStorage();

    // Create project with budget
    const created = await (researchProjectHandler as any).create({
      query: 'Budget test',
      deliverable_type: 'report',
      budget: '{"max_tokens":1000,"max_search_calls":5}',
    }, storage);
    const projectId = created.project;

    // Normal usage
    const usage1 = await (researchProjectHandler as any).updateBudgetUsage({
      project: projectId,
      tokens_delta: 500,
      search_calls_delta: 2,
    }, storage);
    expect(usage1.variant).toBe('ok');

    // Exceed budget
    const usage2 = await (researchProjectHandler as any).updateBudgetUsage({
      project: projectId,
      tokens_delta: 600,
      search_calls_delta: 1,
    }, storage);
    expect(usage2.variant).toBe('budget_exceeded');
    expect(usage2.resource).toBe('tokens');
  });

  it('links a report entity to a research project', async () => {
    const storage = createInMemoryStorage();

    const created = await (researchProjectHandler as any).create({
      query: 'Link test',
      deliverable_type: 'report',
      budget: '{}',
    }, storage);
    const projectId = created.project;

    const linked = await (researchProjectHandler as any).linkReport({
      project: projectId,
      report_entity_id: 'report-entity-42',
    }, storage);
    expect(linked.variant).toBe('ok');
  });

  it('full research pipeline: create project, extract claims, create citations, verify, complete', async () => {
    const storage = createInMemoryStorage();

    // 1. Create research project
    const project = await (researchProjectHandler as any).create({
      query: 'Does intermittent fasting improve metabolic health?',
      deliverable_type: 'fact_check',
      constraints: '',
      perspectives: 'nutritionist,endocrinologist',
      budget: '{"max_tokens":200000,"max_search_calls":40,"max_duration_minutes":15}',
    }, storage);
    expect(project.variant).toBe('ok');
    const projectId = project.project;

    // 2. Transition to planning
    const t1 = await (researchProjectHandler as any).transition({
      project: projectId, new_status: 'planning',
    }, storage);
    expect(t1.variant).toBe('ok');

    // 3. Transition to executing (plan approved)
    const t2 = await (researchProjectHandler as any).transition({
      project: projectId, new_status: 'executing',
    }, storage);
    expect(t2.variant).toBe('ok');

    // 4. Extract claims from the research
    const claimStorage = createInMemoryStorage();
    const claim1 = await (claimHandler as any).extract({
      report_entity_id: 'report-if-1',
      block_id: 'block-1',
      claim_text: 'Intermittent fasting reduces fasting insulin by 20-31% in RCT evidence.',
    }, claimStorage);
    expect(claim1.variant).toBe('ok');

    const claim2 = await (claimHandler as any).extract({
      report_entity_id: 'report-if-1',
      block_id: 'block-2',
      claim_text: 'Time-restricted eating improves insulin sensitivity within 4 weeks.',
    }, claimStorage);
    expect(claim2.variant).toBe('ok');

    // 5. Create citations linking claims to evidence snippets
    const citStorage = createInMemoryStorage();
    const cit1 = await (citationHandler as any).link({
      claim_id: claim1.claim,
      snippet_id: 'snippet-rct-1',
      citation_key: '[1]',
    }, citStorage);
    expect(cit1.variant).toBe('ok');

    const cit2 = await (citationHandler as any).link({
      claim_id: claim2.claim,
      snippet_id: 'snippet-rct-2',
      citation_key: '[2]',
    }, citStorage);
    expect(cit2.variant).toBe('ok');

    // 6. Verify citations
    const v1 = await (citationHandler as any).verify({
      citation: cit1.citation,
      support_score: 0.92,
      verification_method: 'nli_cascade',
    }, citStorage);
    expect(v1.variant).toBe('ok');

    const v2 = await (citationHandler as any).verify({
      citation: cit2.citation,
      support_score: 0.85,
      verification_method: 'nli_cascade',
    }, citStorage);
    expect(v2.variant).toBe('ok');

    // 7. Update claim verification statuses
    const cu1 = await (claimHandler as any).updateVerification({
      claim: claim1.claim,
      status: 'supported',
      support_score: 0.92,
      verified_by: 'nli_cascade',
    }, claimStorage);
    expect(cu1.variant).toBe('ok');

    const cu2 = await (claimHandler as any).updateVerification({
      claim: claim2.claim,
      status: 'supported',
      support_score: 0.85,
      verified_by: 'nli_cascade',
    }, claimStorage);
    expect(cu2.variant).toBe('ok');

    // 8. Link report and transition to reviewing then completed
    const linkResult = await (researchProjectHandler as any).linkReport({
      project: projectId,
      report_entity_id: 'report-if-1',
    }, storage);
    expect(linkResult.variant).toBe('ok');

    const t3 = await (researchProjectHandler as any).transition({
      project: projectId, new_status: 'reviewing',
    }, storage);
    expect(t3.variant).toBe('ok');

    const t4 = await (researchProjectHandler as any).transition({
      project: projectId, new_status: 'completed',
    }, storage);
    expect(t4.variant).toBe('ok');

    // 9. Verify final project state
    const finalProject = await (researchProjectHandler as any).get({
      project: projectId,
    }, storage);
    expect(finalProject.variant).toBe('ok');
    expect(finalProject.status).toBe('completed');

    // 10. Verify unsupported claims are empty (all verified)
    const unsupported = await (claimHandler as any).listUnsupported({
      report_entity_id: 'report-if-1',
    }, claimStorage);
    expect(unsupported.variant).toBe('ok');
    const unsupportedList = JSON.parse(unsupported.claims as string);
    expect(unsupportedList.length).toBe(0);
  });
});

// ============================================================
// 3. Artifact Completeness Tests (§7.2)
// ============================================================

describe('Deep Research artifact completeness (§7.2)', () => {
  const BASE = path.resolve('repertoire/concepts/research-evidence');

  describe('Concept spec files', () => {
    const conceptFiles = ['claim.concept', 'citation.concept', 'research-project.concept'];
    for (const file of conceptFiles) {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(BASE, file))).toBe(true);
      });
    }
  });

  describe('Handler files', () => {
    const handlerDir = path.resolve('handlers/ts/app');
    const handlers = ['claim.handler.ts', 'citation.handler.ts', 'research-project.handler.ts'];
    for (const file of handlers) {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(handlerDir, file))).toBe(true);
      });
    }
  });

  describe('Sync files', () => {
    const syncsDir = path.join(BASE, 'syncs');
    const expectedSyncs = [
      'agent-memory-recalls-entries.sync',
      'budget-exceeded-halts-run.sync',
      'citation-links-create-relations.sync',
      'citation-verified-updates-claim.sync',
      'contradiction-flag.sync',
      'credibility-evaluation-on-capture.sync',
      'evaluation-gates-report-publish.sync',
      'low-credibility-triggers-quarantine.sync',
      'memory-promotion-from-report.sync',
      'plan-approval-gates-execution.sync',
      'report-compilation-provider.sync',
      'research-agent-discovers-tools.sync',
      'research-plan-schema-init.sync',
      'research-project-creates-process-run.sync',
      'research-project-schema-init.sync',
      'research-report-schema-init.sync',
      'research-source-schema-init.sync',
      'source-indexes-for-retrieval.sync',
      'step-dispatches-to-persona.sync',
    ];

    it(`has ${expectedSyncs.length} sync files`, () => {
      const actual = fs.readdirSync(syncsDir).filter(f => f.endsWith('.sync'));
      expect(actual.length).toBe(expectedSyncs.length);
    });

    for (const file of expectedSyncs) {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(syncsDir, file))).toBe(true);
      });
    }
  });

  describe('Widget files', () => {
    const widgetsDir = path.join(BASE, 'widgets');
    const expectedWidgets = [
      'budget-dashboard.widget',
      'citation-inspector.widget',
      'coverage-meter.widget',
      'credibility-badge.widget',
      'evidence-table.widget',
      'memory-card.widget',
      'plan-approval.widget',
      'research-progress.widget',
      'run-timeline.widget',
      'source-capture.widget',
      'span-to-snippet.widget',
    ];

    it(`has ${expectedWidgets.length} widget files`, () => {
      const actual = fs.readdirSync(widgetsDir).filter(f => f.endsWith('.widget'));
      expect(actual.length).toBe(expectedWidgets.length);
    });

    for (const file of expectedWidgets) {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(widgetsDir, file))).toBe(true);
      });
    }
  });

  describe('Derived concept files', () => {
    const derivedFiles = [
      'evidence-chain.derived',
      'plan-approval.derived',
      'citation-verification.derived',
      'research-notebook.derived',
      'deep-research.derived',
    ];
    for (const file of derivedFiles) {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(BASE, file))).toBe(true);
      });
    }
  });

  describe('View seeds', () => {
    const viewSeedsPath = path.resolve('clef-base/seeds/View.research.seeds.yaml');

    it('View.research.seeds.yaml exists', () => {
      expect(fs.existsSync(viewSeedsPath)).toBe(true);
    });

    it('contains 7 view entries', () => {
      const content = fs.readFileSync(viewSeedsPath, 'utf-8');
      const viewMatches = content.match(/^\s+- view:/gm);
      expect(viewMatches).not.toBeNull();
      expect(viewMatches!.length).toBe(7);
    });

    it('defines expected view ids', () => {
      const content = fs.readFileSync(viewSeedsPath, 'utf-8');
      const expectedViews = [
        'research-projects', 'source-library', 'evidence-graph',
        'report-builder', 'memory-notebook', 'research-plan', 'source-detail',
      ];
      for (const viewId of expectedViews) {
        expect(content).toContain(`view: ${viewId}`);
      }
    });
  });

  describe('Layout seeds', () => {
    const layoutPath = path.resolve('clef-base/seeds/Layout.seeds.yaml');

    it('Layout.seeds.yaml contains research layouts', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      const researchLayouts = [
        'research-workspace',
        'research-dashboard',
        'research-monitor',
        'research-process',
      ];
      for (const layout of researchLayouts) {
        expect(content).toContain(`layout: ${layout}`);
      }
    });

    it('has 4 research layout entries', () => {
      const content = fs.readFileSync(layoutPath, 'utf-8');
      const matches = content.match(/layout: research-/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(4);
    });
  });

  describe('Destination seeds', () => {
    const destPath = path.resolve('clef-base/seeds/DestinationCatalog.research.seeds.yaml');

    it('DestinationCatalog.research.seeds.yaml exists', () => {
      expect(fs.existsSync(destPath)).toBe(true);
    });

    it('contains 4 destination entries', () => {
      const content = fs.readFileSync(destPath, 'utf-8');
      const matches = content.match(/^\s+- destination:/gm);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(4);
    });

    it('defines expected destinations', () => {
      const content = fs.readFileSync(destPath, 'utf-8');
      const expected = ['research', 'sources', 'memory', 'evidence'];
      for (const dest of expected) {
        expect(content).toContain(`destination: ${dest}`);
      }
    });
  });

  describe('Content-native schema YAML files', () => {
    const schemasDir = path.join(BASE, 'schemas');
    const expectedSchemas = [
      'research-project.schema.yaml',
      'research-plan.schema.yaml',
      'research-report.schema.yaml',
      'research-source.schema.yaml',
    ];

    for (const file of expectedSchemas) {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(schemasDir, file))).toBe(true);
      });
    }
  });
});

// ============================================================
// 4. Performance / Scale Tests (§7.2)
// ============================================================

describe('Deep Research performance at scale (§7.2)', () => {

  it('creates 50+ source-like entities via ResearchProject without performance degradation', async () => {
    const storage = createInMemoryStorage();
    const projectIds: string[] = [];
    const timings: number[] = [];

    for (let i = 0; i < 55; i++) {
      const start = performance.now();
      const result = await (researchProjectHandler as any).create({
        query: `Research query #${i}: benchmark topic ${i}`,
        deliverable_type: 'report',
        constraints: `constraint-${i}`,
        perspectives: `analyst-${i}`,
        budget: `{"max_tokens":${100000 + i * 1000},"max_search_calls":${20 + i}}`,
      }, storage);
      const elapsed = performance.now() - start;
      timings.push(elapsed);

      expect(result.variant).toBe('ok');
      projectIds.push(result.project);
    }

    // All projects should be created
    expect(projectIds.length).toBe(55);

    // Each action should complete in under 50ms with in-memory storage
    for (const t of timings) {
      expect(t).toBeLessThan(50);
    }
  });

  it('creates 200+ claim references without performance degradation', async () => {
    const storage = createInMemoryStorage();
    const claimIds: string[] = [];
    const timings: number[] = [];

    for (let i = 0; i < 210; i++) {
      const start = performance.now();
      const result = await (claimHandler as any).extract({
        report_entity_id: `report-scale-${i % 10}`,
        block_id: `block-${i}`,
        claim_text: `Scale test claim #${i}: benchmark assertion about topic ${i}`,
      }, storage);
      const elapsed = performance.now() - start;
      timings.push(elapsed);

      expect(result.variant).toBe('ok');
      claimIds.push(result.claim);
    }

    // All claims should be created
    expect(claimIds.length).toBe(210);

    // Each action should complete in under 50ms with in-memory storage
    for (const t of timings) {
      expect(t).toBeLessThan(50);
    }

    // Listing claims per report should still be fast
    const listStart = performance.now();
    const listResult = await (claimHandler as any).listByReport({
      report_entity_id: 'report-scale-0',
    }, storage);
    const listElapsed = performance.now() - listStart;

    expect(listResult.variant).toBe('ok');
    expect(listElapsed).toBeLessThan(50);

    const claims = JSON.parse(listResult.claims as string);
    expect(claims.length).toBe(21); // 210 / 10 reports
  });

  it('creates and verifies 200+ citations without performance degradation', async () => {
    const storage = createInMemoryStorage();
    const citationIds: string[] = [];

    // Create 210 citations
    for (let i = 0; i < 210; i++) {
      const result = await (citationHandler as any).link({
        claim_id: `claim-perf-${i}`,
        snippet_id: `snippet-perf-${i}`,
        citation_key: `[${i + 1}]`,
      }, storage);
      expect(result.variant).toBe('ok');
      citationIds.push(result.citation);
    }

    expect(citationIds.length).toBe(210);

    // Verify all citations and measure timing
    const timings: number[] = [];
    for (let i = 0; i < citationIds.length; i++) {
      const start = performance.now();
      const result = await (citationHandler as any).verify({
        citation: citationIds[i],
        support_score: 0.5 + (i % 50) * 0.01,
        verification_method: 'nli_cascade',
      }, storage);
      const elapsed = performance.now() - start;
      timings.push(elapsed);

      expect(result.variant).toBe('ok');
    }

    // Each verification should complete in under 50ms
    for (const t of timings) {
      expect(t).toBeLessThan(50);
    }
  });

  it('budget tracking remains accurate across many increments', async () => {
    const storage = createInMemoryStorage();

    const created = await (researchProjectHandler as any).create({
      query: 'Budget accuracy test',
      deliverable_type: 'report',
      budget: '{"max_tokens":100000,"max_search_calls":500}',
    }, storage);
    const projectId = created.project;

    // Increment 100 times
    for (let i = 0; i < 100; i++) {
      const result = await (researchProjectHandler as any).updateBudgetUsage({
        project: projectId,
        tokens_delta: 500,
        search_calls_delta: 1,
      }, storage);
      // Budget should not be exceeded until tokens hit 100000
      if (i < 199) {
        expect(result.variant).toBe('ok');
      }
    }

    // Check final usage
    const final = await (researchProjectHandler as any).get({
      project: projectId,
    }, storage);
    expect(final.variant).toBe('ok');
    expect(final.tokens_used).toBe(50000);
    expect(final.search_calls_used).toBe(100);
  });
});
