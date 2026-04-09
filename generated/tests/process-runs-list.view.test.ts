// generated/tests/process-runs-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\process-runs-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: process-runs-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "process-runs-list-dataSource", {"name":"process-runs-list-dataSource","kind":"concept-action","config":"{\"concept\":\"ProcessRun\",\"action\":\"list\"}"});
    await storage.put("presentation", "process-runs-list-presentation", {"name":"process-runs-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "process-runs-list-filter", {"name":"process-runs-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "process-runs-list-sort", {"name":"process-runs-list-sort","keys":"[]"});
    await storage.put("projection", "process-runs-list-projection", {"name":"process-runs-list-projection","fields":"[]"});
    await storage.put("interaction", "process-runs-list-interaction", {"name":"process-runs-list-interaction","rowActions":"[{\"key\":\"view\",\"concept\":\"ProcessRun\",\"action\":\"get\",\"label\":\"View\"}]"});
    await storage.put('view', "process-runs-list", {"name":"process-runs-list","title":"process-runs-list","description":"","dataSource":"process-runs-list-dataSource","filter":"process-runs-list-filter","sort":"process-runs-list-sort","group":"","projection":"process-runs-list-projection","presentation":"process-runs-list-presentation","interaction":"process-runs-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("process-runs-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
