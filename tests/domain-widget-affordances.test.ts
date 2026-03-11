import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();

const widgetExpectations: Array<{ path: string; snippets: string[] }> = [
  {
    path: 'repertoire/widgets/domain/approval-tracker.widget',
    snippets: ['suite: "governance-execution"', 'tags: ["approval", "tracker", "execution"]'],
  },
  {
    path: 'repertoire/widgets/domain/cron-editor.widget',
    snippets: ['concept: "Timer"', 'tags: ["temporal", "schedule", "editor"]'],
  },
  {
    path: 'repertoire/widgets/domain/field-mapper.widget',
    snippets: ['concept: "ConnectorCall"', 'tags: ["mapping", "integration", "editor"]'],
  },
  {
    path: 'repertoire/widgets/domain/graph-view.widget',
    snippets: ['concept: "Contract"', 'tags: ["contract", "graph", "verification"]', 'concept: "Delegation"', 'tags: ["delegation", "graph", "governance"]'],
  },
  {
    path: 'repertoire/widgets/domain/message-actions.widget',
    snippets: ['suite: "llm-conversation"', 'tags: ["message", "actions", "conversation"]'],
  },
  {
    path: 'repertoire/widgets/domain/quorum-gauge.widget',
    snippets: ['suite: "governance-decision"', 'tags: ["quorum", "decision", "metric"]'],
  },
  {
    path: 'repertoire/widgets/domain/segmented-progress-bar.widget',
    snippets: ['concept: "VerificationRun"', 'tags: ["verification", "progress", "status"]'],
  },
  {
    path: 'repertoire/widgets/domain/workflow-editor.widget',
    snippets: ['concept: "ProcessSpec"', 'tags: ["workflow", "process", "editor"]'],
  },
  {
    path: 'repertoire/widgets/domain/governance/approval-detail.widget',
    snippets: ['suite: "governance"', 'tags: ["approval", "decision", "detail"]', 'tags: ["approval", "decision", "editor"]', 'secondaryRoles {'],
  },
  {
    path: 'repertoire/widgets/domain/governance/governance-entity-card.widget',
    snippets: ['suite: "governance"', 'tags: ["governance", "summary", "card"]', 'tags: ["governance", "summary", "detail"]'],
  },
];

describe('domain widget affordances', () => {
  for (const expectation of widgetExpectations) {
    it(`keeps ${expectation.path} aligned with the entity-affordance pipeline`, () => {
      const source = readFileSync(resolve(repoRoot, expectation.path), 'utf8');
      for (const snippet of expectation.snippets) {
        expect(source).toContain(snippet);
      }
    });
  }
});
