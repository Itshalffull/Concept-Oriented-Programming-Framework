// generated/tests/check-overview.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\check-overview.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: check-overview', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "check-overview-dataSource", {"name":"check-overview-dataSource","kind":"concept-action","config":"{\"concept\":\"CheckVerification\",\"action\":\"list\"}"});
    await storage.put("presentation", "check-overview-presentation", {"name":"check-overview-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "check-overview-filter", {"name":"check-overview-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "check-overview-sort", {"name":"check-overview-sort","keys":"[]"});
    await storage.put("projection", "check-overview-projection", {"name":"check-overview-projection","fields":"[{\"key\":\"check_ref\",\"label\":\"Check\"},{\"key\":\"step_ref\",\"label\":\"Step\"},{\"key\":\"status\",\"label\":\"Status\"},{\"key\":\"result_score\",\"label\":\"Score\"},{\"key\":\"mode\",\"label\":\"Mode\"},{\"key\":\"evaluated_at\",\"label\":\"Evaluated\"}]"});
    await storage.put("interaction", "check-overview-interaction", {"name":"check-overview-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "check-overview", {"name":"check-overview","title":"check-overview","description":"","dataSource":"check-overview-dataSource","filter":"check-overview-filter","sort":"check-overview-sort","group":"","projection":"check-overview-projection","presentation":"check-overview-presentation","interaction":"check-overview-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("check-overview", storage);
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
