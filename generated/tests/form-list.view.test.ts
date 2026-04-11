// generated/tests/form-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\form-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: form-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "form-list-dataSource", {"name":"form-list-dataSource","kind":"concept-action","config":"{\"concept\":\"FormSpec\",\"action\":\"list\"}"});
    await storage.put("presentation", "form-list-presentation", {"name":"form-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "form-list-filter", {"name":"form-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "form-list-sort", {"name":"form-list-sort","keys":"[{\"field\":\"schema\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "form-list-projection", {"name":"form-list-projection","fields":"[{\"key\":\"name\",\"label\":\"Form Name\"},{\"key\":\"schema\",\"label\":\"Schema\",\"formatter\":\"badge\"},{\"key\":\"mode\",\"label\":\"Mode\",\"formatter\":\"badge\"}]"});
    await storage.put('view', "form-list", {"name":"form-list","title":"form-list","description":"","dataSource":"form-list-dataSource","filter":"form-list-filter","sort":"form-list-sort","group":"","projection":"form-list-projection","presentation":"form-list-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("form-list", storage);
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
