// generated/tests/simple-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\simple-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: simple-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "simple-list-dataSource", {"name":"simple-list-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "simple-list-presentation", {"name":"simple-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "simple-list-sort", {"name":"simple-list-sort","keys":"[]"});
    await storage.put('view', "simple-list", {"name":"simple-list","title":"simple-list","description":"","dataSource":"simple-list-dataSource","filter":"","sort":"simple-list-sort","group":"","projection":"","presentation":"simple-list-presentation","interaction":"","features":"[\"sort\"]","pagination":""});
    analysis = await compileAndAnalyze("simple-list", storage);
  });

  describe('invariants', () => {
  it("always: read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });
  });
});
