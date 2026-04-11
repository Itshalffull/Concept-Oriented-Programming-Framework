// generated/tests/schema-admin-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\schema-admin-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: schema-admin-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "schema-admin-list-dataSource", {"name":"schema-admin-list-dataSource","kind":"concept-action","config":"{\"concept\":\"Schema\",\"action\":\"list\"}"});
    await storage.put("presentation", "schema-admin-list-presentation", {"name":"schema-admin-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "schema-admin-list-filter", {"name":"schema-admin-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "schema-admin-list-sort", {"name":"schema-admin-list-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "schema-admin-list-projection", {"name":"schema-admin-list-projection","fields":"[{\"key\":\"name\",\"label\":\"Name\"},{\"key\":\"fieldCount\",\"label\":\"Fields\",\"formatter\":\"number\"},{\"key\":\"entityCount\",\"label\":\"Entities\",\"formatter\":\"number\"},{\"key\":\"updatedAt\",\"label\":\"Last Modified\",\"formatter\":\"relative-date\"}]"});
    await storage.put("interaction", "schema-admin-list-interaction", {"name":"schema-admin-list-interaction","createForm":"{\"concept\":\"Schema\",\"action\":\"defineSchema\"}","rowClick":"{\"navigateTo\":\"/admin/schemas/{name}\"}","rowActions":"[{\"key\":\"delete\",\"concept\":\"Schema\",\"action\":\"remove\",\"label\":\"Delete\",\"destructive\":true}]"});
    await storage.put('view', "schema-admin-list", {"name":"schema-admin-list","title":"schema-admin-list","description":"","dataSource":"schema-admin-list-dataSource","filter":"schema-admin-list-filter","sort":"schema-admin-list-sort","group":"","projection":"schema-admin-list-projection","presentation":"schema-admin-list-presentation","interaction":"schema-admin-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("schema-admin-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only Schema actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("Schema/")).toBe(true);
    }
  });

  it("always: all invoke variants covered", () => {
    expect(analysis.uncoveredVariants).toEqual([]);
  });

  it("always: projects only known fields", () => {
    for (const f of analysis.projectedFields) {
      expect(["name", "fieldCount", "entityCount", "updatedAt"]).toContain(f);
    }
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
