// generated/tests/step-bottlenecks.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\step-bottlenecks.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: step-bottlenecks', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "step-bottlenecks-dataSource", {"name":"step-bottlenecks-dataSource","kind":"concept-action","config":"{\"concept\":\"StepRun\",\"action\":\"list\"}"});
    await storage.put("presentation", "step-bottlenecks-presentation", {"name":"step-bottlenecks-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "step-bottlenecks-filter", {"name":"step-bottlenecks-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "step-bottlenecks-sort", {"name":"step-bottlenecks-sort","keys":"[]"});
    await storage.put("group", "step-bottlenecks-group", {"name":"step-bottlenecks-group","config":"{\"type\":\"field\",\"fields\":[\"step_key\"]}"});
    await storage.put("projection", "step-bottlenecks-projection", {"name":"step-bottlenecks-projection","fields":"[]"});
    await storage.put('view', "step-bottlenecks", {"name":"step-bottlenecks","title":"step-bottlenecks","description":"","dataSource":"step-bottlenecks-dataSource","filter":"step-bottlenecks-filter","sort":"step-bottlenecks-sort","group":"step-bottlenecks-group","projection":"step-bottlenecks-projection","presentation":"step-bottlenecks-presentation","interaction":"","features":"[\"filter\",\"sort\",\"group\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("step-bottlenecks", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: uses grouping", () => {
    expect(analysis.enabledFeatures).toContain("group");
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
