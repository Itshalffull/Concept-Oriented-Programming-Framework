// generated/tests/schema-table.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\schema-table.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: schema-table', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "schema-table-dataSource", {"name":"schema-table-dataSource","kind":"concept-action","config":"{\"concept\":\"FieldDefinition\",\"action\":\"list\",\"params\":{\"schema\":\"Article\"}}"});
    await storage.put("presentation", "schema-table-presentation", {"name":"schema-table-presentation","displayType":"table","hints":"{\"cellEdit\":true,\"columnAdd\":true,\"columnEdit\":true,\"columnReorder\":true}"});
    await storage.put("filter", "schema-table-filter", {"name":"schema-table-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "schema-table-sort", {"name":"schema-table-sort","keys":"[{\"field\":\"sortOrder\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "schema-table-projection", {"name":"schema-table-projection","fields":"[{\"key\":\"fieldId\",\"label\":\"Field ID\",\"formatter\":\"code\"},{\"key\":\"label\",\"label\":\"Label\"},{\"key\":\"fieldType\",\"label\":\"Type\",\"formatter\":\"badge\"},{\"key\":\"required\",\"label\":\"Required\",\"formatter\":\"boolean-badge\"},{\"key\":\"unique\",\"label\":\"Unique\",\"formatter\":\"boolean-badge\"},{\"key\":\"defaultValue\",\"label\":\"Default\"},{\"key\":\"sortOrder\",\"label\":\"Order\"}]"});
    await storage.put("interaction", "schema-table-interaction", {"name":"schema-table-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put("pagination", "schema-table-pagination", {"name":"schema-table-pagination","mode":"offset","pageSize":"25"});
    await storage.put('view', "schema-table", {"name":"schema-table","title":"schema-table","description":"","dataSource":"schema-table-dataSource","filter":"schema-table-filter","sort":"schema-table-sort","group":"","projection":"schema-table-projection","presentation":"schema-table-presentation","interaction":"schema-table-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\",\"pagination\"]","pagination":"schema-table-pagination"});
    analysis = await compileAndAnalyze("schema-table", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only FieldDefinition actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("FieldDefinition/")).toBe(true);
    }
  });

  it("always: all invoke variants covered", () => {
    expect(analysis.uncoveredVariants).toEqual([]);
  });

  it("always: projects only known fields", () => {
    for (const f of analysis.projectedFields) {
      expect(["fieldId", "label", "fieldType", "required", "unique", "defaultValue", "sortOrder"]).toContain(f);
    }
  });
  });
});
