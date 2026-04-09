// generated/tests/my-work-items.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\my-work-items.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: my-work-items', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "my-work-items-dataSource", {"name":"my-work-items-dataSource","kind":"concept-action","config":"{\"concept\":\"WorkItem\",\"action\":\"list\",\"params\":{\"assignee\":\"{{currentUser}}\"}}"});
    await storage.put("presentation", "my-work-items-presentation", {"name":"my-work-items-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "my-work-items-filter", {"name":"my-work-items-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "my-work-items-sort", {"name":"my-work-items-sort","keys":"[]"});
    await storage.put("projection", "my-work-items-projection", {"name":"my-work-items-projection","fields":"[]"});
    await storage.put("interaction", "my-work-items-interaction", {"name":"my-work-items-interaction","rowActions":"[{\"key\":\"complete\",\"concept\":\"WorkItem\",\"action\":\"complete\",\"label\":\"Complete\"}]"});
    await storage.put('view', "my-work-items", {"name":"my-work-items","title":"my-work-items","description":"","dataSource":"my-work-items-dataSource","filter":"my-work-items-filter","sort":"my-work-items-sort","group":"","projection":"my-work-items-projection","presentation":"my-work-items-presentation","interaction":"my-work-items-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("my-work-items", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only WorkItem actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("WorkItem/")).toBe(true);
    }
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
