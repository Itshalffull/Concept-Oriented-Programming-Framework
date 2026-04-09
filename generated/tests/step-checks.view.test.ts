// generated/tests/step-checks.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\step-checks.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: step-checks', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "step-checks-dataSource", {"name":"step-checks-dataSource","kind":"concept-action","config":"{\"concept\":\"CheckVerification\",\"action\":\"list\",\"params\":{\"step_ref\":\"{{stepRef}}\"}}"});
    await storage.put("presentation", "step-checks-presentation", {"name":"step-checks-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "step-checks-filter", {"name":"step-checks-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "step-checks-sort", {"name":"step-checks-sort","keys":"[]"});
    await storage.put("projection", "step-checks-projection", {"name":"step-checks-projection","fields":"[]"});
    await storage.put('view', "step-checks", {"name":"step-checks","title":"step-checks","description":"","dataSource":"step-checks-dataSource","filter":"step-checks-filter","sort":"step-checks-sort","group":"","projection":"step-checks-projection","presentation":"step-checks-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("step-checks", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
