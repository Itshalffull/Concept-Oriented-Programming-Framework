// generated/tests/process-step-breakdown.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\process-step-breakdown.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: process-step-breakdown', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "process-step-breakdown-dataSource", {"name":"process-step-breakdown-dataSource","kind":"concept-action","config":"{\"concept\":\"StepRun\",\"action\":\"list\"}"});
    await storage.put("presentation", "process-step-breakdown-presentation", {"name":"process-step-breakdown-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "process-step-breakdown-filter", {"name":"process-step-breakdown-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "process-step-breakdown-sort", {"name":"process-step-breakdown-sort","keys":"[]"});
    await storage.put("group", "process-step-breakdown-group", {"name":"process-step-breakdown-group","config":"{\"type\":\"field\",\"fields\":[\"step_key\"]}"});
    await storage.put("projection", "process-step-breakdown-projection", {"name":"process-step-breakdown-projection","fields":"[]"});
    await storage.put('view', "process-step-breakdown", {"name":"process-step-breakdown","title":"process-step-breakdown","description":"","dataSource":"process-step-breakdown-dataSource","filter":"process-step-breakdown-filter","sort":"process-step-breakdown-sort","group":"process-step-breakdown-group","projection":"process-step-breakdown-projection","presentation":"process-step-breakdown-presentation","interaction":"","features":"[\"filter\",\"sort\",\"group\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("process-step-breakdown", storage);
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
