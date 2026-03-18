// ============================================================
// TestGenTypeScript Provider — Functional Style
//
// Renders a language-neutral TestPlan into TypeScript conformance
// test code using vitest and StorageProgram analysis utilities.
// Wraps the typescript-test-renderer for use as a concept handler.
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, find, pure, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { renderTypeScriptTests } from './typescript-test-renderer.ts';
import type { TestPlan } from './test-gen.handler.ts';

const RESULTS = 'test-gen-typescript-results';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `tgts-${++idCounter}`;
}

export function resetTestGenTypeScriptCounter(): void {
  idCounter = 0;
}

export const testGenTypeScriptHandler: FunctionalConceptHandler = {

  render(input: Record<string, unknown>) {
    const testPlanJson = input.test_plan as string;
    const outputPath = input.output_path as string;

    if (!testPlanJson || !outputPath) {
      return complete(createProgram(), 'invalid', {
        message: 'test_plan and output_path are required',
      }) as StorageProgram<Result>;
    }

    let plan: TestPlan;
    try {
      plan = JSON.parse(testPlanJson) as TestPlan;
    } catch {
      return complete(createProgram(), 'invalid', {
        message: `Failed to parse test_plan JSON: ${testPlanJson.slice(0, 100)}`,
      }) as StorageProgram<Result>;
    }

    if (!plan.conceptName || !plan.actions) {
      return complete(createProgram(), 'invalid', {
        message: 'TestPlan missing required fields: conceptName, actions',
      }) as StorageProgram<Result>;
    }

    const renderedCode = renderTypeScriptTests(plan);
    const testCount = countTests(renderedCode);
    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RESULTS, id, {
      id,
      test_plan: testPlanJson,
      rendered_code: renderedCode,
      file_path: outputPath,
      rendered_at: now,
      test_count: testCount,
    });

    return complete(p, 'ok', {
      result: id,
      rendered_code: renderedCode,
      file_path: outputPath,
      test_count: testCount,
    }) as StorageProgram<Result>;
  },

  renderBatch(input: Record<string, unknown>) {
    const plansJson = input.test_plans as string;

    if (!plansJson) {
      return complete(createProgram(), 'error', {
        message: 'test_plans is required',
      }) as StorageProgram<Result>;
    }

    let items: Array<{ test_plan: string; output_path: string }>;
    try {
      items = JSON.parse(plansJson);
    } catch {
      return complete(createProgram(), 'error', {
        message: 'Failed to parse test_plans JSON array',
      }) as StorageProgram<Result>;
    }

    const results: Array<{ file_path: string; test_count: number }> = [];
    let totalTests = 0;
    let p = createProgram();

    for (const item of items) {
      let plan: TestPlan;
      try {
        plan = JSON.parse(item.test_plan) as TestPlan;
      } catch {
        continue;
      }
      if (!plan.conceptName || !plan.actions) continue;

      const renderedCode = renderTypeScriptTests(plan);
      const testCount = countTests(renderedCode);
      const id = nextId();

      p = put(p, RESULTS, id, {
        id,
        test_plan: item.test_plan,
        rendered_code: renderedCode,
        file_path: item.output_path,
        rendered_at: new Date().toISOString(),
        test_count: testCount,
      });

      results.push({ file_path: item.output_path, test_count: testCount });
      totalTests += testCount;
    }

    return complete(p, 'ok', {
      results: JSON.stringify(results),
      total_files: results.length,
      total_tests: totalTests,
    }) as StorageProgram<Result>;
  },

  listRendered(input: Record<string, unknown>) {
    const concept_ref = input.concept_ref as string;
    void concept_ref;

    let p = createProgram();
    p = find(p, RESULTS, {}, 'allResults');
    return complete(p, 'ok', {
      results: '[]',
    }) as StorageProgram<Result>;
  },
};

function countTests(code: string): number {
  const matches = code.match(/\bit\(/g);
  return matches ? matches.length : 0;
}
