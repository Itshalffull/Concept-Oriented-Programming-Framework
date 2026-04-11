// generated/tests/active-proposals.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\active-proposals.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: active-proposals', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "active-proposals-dataSource", {"name":"active-proposals-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"Proposal\"}}"});
    await storage.put("presentation", "active-proposals-presentation", {"name":"active-proposals-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "active-proposals-filter", {"name":"active-proposals-filter","node":"{\"type\":\"eq\",\"field\":\"status\",\"value\":\"active\"}"});
    await storage.put("sort", "active-proposals-sort", {"name":"active-proposals-sort","keys":"[{\"field\":\"createdAt\",\"direction\":\"desc\"}]"});
    await storage.put("projection", "active-proposals-projection", {"name":"active-proposals-projection","fields":"[{\"key\":\"node\",\"label\":\"Proposal\"},{\"key\":\"status\",\"label\":\"Status\"},{\"key\":\"circle\",\"label\":\"Circle\"},{\"key\":\"proposer\",\"label\":\"Proposer\"},{\"key\":\"votes\",\"label\":\"Votes\"}]"});
    await storage.put("interaction", "active-proposals-interaction", {"name":"active-proposals-interaction","createForm":"{}","rowClick":"{\"navigateTo\":\"/content/{node}\"}","rowActions":"[{\"key\":\"vote\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Vote\"}]"});
    await storage.put('view', "active-proposals", {"name":"active-proposals","title":"active-proposals","description":"","dataSource":"active-proposals-dataSource","filter":"active-proposals-filter","sort":"active-proposals-sort","group":"","projection":"active-proposals-projection","presentation":"active-proposals-presentation","interaction":"active-proposals-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("active-proposals", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only ContentNode actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ContentNode/")).toBe(true);
    }
  });

  it("always: all invoke variants covered", () => {
    expect(analysis.uncoveredVariants).toEqual([]);
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
