// generated/tests/source-detail.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\source-detail.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: source-detail', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "source-detail-dataSource", {"name":"source-detail-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "source-detail-presentation", {"name":"source-detail-presentation","displayType":"table","hints":"{}"});
    await storage.put("projection", "source-detail-projection", {"name":"source-detail-projection","fields":"[]"});
    await storage.put("interaction", "source-detail-interaction", {"name":"source-detail-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "source-detail", {"name":"source-detail","title":"source-detail","description":"","dataSource":"source-detail-dataSource","filter":"","sort":"","group":"","projection":"source-detail-projection","presentation":"source-detail-presentation","interaction":"source-detail-interaction","features":"[\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("source-detail", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });
  });
});
