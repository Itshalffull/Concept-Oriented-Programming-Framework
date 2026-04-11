// generated/tests/syncs-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\syncs-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: syncs-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "syncs-list-dataSource", {"name":"syncs-list-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"Sync\"}}"});
    await storage.put("presentation", "syncs-list-presentation", {"name":"syncs-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "syncs-list-filter", {"name":"syncs-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "syncs-list-sort", {"name":"syncs-list-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "syncs-list-projection", {"name":"syncs-list-projection","fields":"[]"});
    await storage.put('view', "syncs-list", {"name":"syncs-list","title":"syncs-list","description":"","dataSource":"syncs-list-dataSource","filter":"syncs-list-filter","sort":"syncs-list-sort","group":"","projection":"syncs-list-projection","presentation":"syncs-list-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("syncs-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });
  });
});
