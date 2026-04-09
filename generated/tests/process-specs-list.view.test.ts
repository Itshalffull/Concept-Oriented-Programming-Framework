// generated/tests/process-specs-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\process-specs-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: process-specs-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "process-specs-list-dataSource", {"name":"process-specs-list-dataSource","kind":"concept-action","config":"{\"concept\":\"ProcessSpec\",\"action\":\"list\"}"});
    await storage.put("presentation", "process-specs-list-presentation", {"name":"process-specs-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "process-specs-list-filter", {"name":"process-specs-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "process-specs-list-sort", {"name":"process-specs-list-sort","keys":"[]"});
    await storage.put("projection", "process-specs-list-projection", {"name":"process-specs-list-projection","fields":"[]"});
    await storage.put("interaction", "process-specs-list-interaction", {"name":"process-specs-list-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ProcessSpec\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "process-specs-list", {"name":"process-specs-list","title":"process-specs-list","description":"","dataSource":"process-specs-list-dataSource","filter":"process-specs-list-filter","sort":"process-specs-list-sort","group":"","projection":"process-specs-list-projection","presentation":"process-specs-list-presentation","interaction":"process-specs-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("process-specs-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only ProcessSpec actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ProcessSpec/")).toBe(true);
    }
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
