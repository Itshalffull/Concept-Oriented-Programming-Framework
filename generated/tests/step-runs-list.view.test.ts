// generated/tests/step-runs-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\step-runs-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: step-runs-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "step-runs-list-dataSource", {"name":"step-runs-list-dataSource","kind":"concept-action","config":"{\"concept\":\"StepRun\",\"action\":\"list\",\"params\":{\"run_ref\":\"{{runId}}\"}}"});
    await storage.put("presentation", "step-runs-list-presentation", {"name":"step-runs-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "step-runs-list-filter", {"name":"step-runs-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "step-runs-list-sort", {"name":"step-runs-list-sort","keys":"[]"});
    await storage.put("projection", "step-runs-list-projection", {"name":"step-runs-list-projection","fields":"[]"});
    await storage.put("pagination", "step-runs-list-pagination", {"name":"step-runs-list-pagination","mode":"offset","pageSize":"25"});
    await storage.put('view', "step-runs-list", {"name":"step-runs-list","title":"step-runs-list","description":"","dataSource":"step-runs-list-dataSource","filter":"step-runs-list-filter","sort":"step-runs-list-sort","group":"","projection":"step-runs-list-projection","presentation":"step-runs-list-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\",\"pagination\"]","pagination":"step-runs-list-pagination"});
    analysis = await compileAndAnalyze("step-runs-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: has pagination", () => {
    expect(analysis.enabledFeatures).toContain("pagination");
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
