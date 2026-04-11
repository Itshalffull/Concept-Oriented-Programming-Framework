// generated/tests/check-failures.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\check-failures.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: check-failures', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "check-failures-dataSource", {"name":"check-failures-dataSource","kind":"concept-action","config":"{\"concept\":\"CheckVerification\",\"action\":\"list\",\"params\":{\"status\":\"failing\"}}"});
    await storage.put("presentation", "check-failures-presentation", {"name":"check-failures-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "check-failures-filter", {"name":"check-failures-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "check-failures-sort", {"name":"check-failures-sort","keys":"[]"});
    await storage.put("projection", "check-failures-projection", {"name":"check-failures-projection","fields":"[{\"key\":\"check_ref\",\"label\":\"Check\"},{\"key\":\"step_ref\",\"label\":\"Step\"},{\"key\":\"status\",\"label\":\"Status\"},{\"key\":\"result_score\",\"label\":\"Score\"},{\"key\":\"result_evidence\",\"label\":\"Evidence\"}]"});
    await storage.put('view', "check-failures", {"name":"check-failures","title":"check-failures","description":"","dataSource":"check-failures-dataSource","filter":"check-failures-filter","sort":"check-failures-sort","group":"","projection":"check-failures-projection","presentation":"check-failures-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("check-failures", storage);
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
