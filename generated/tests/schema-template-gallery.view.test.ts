// generated/tests/schema-template-gallery.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\schema-template-gallery.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: schema-template-gallery', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "schema-template-gallery-dataSource", {"name":"schema-template-gallery-dataSource","kind":"concept-action","config":"{\"concept\":\"SchemaTemplate\",\"action\":\"list\"}"});
    await storage.put("presentation", "schema-template-gallery-presentation", {"name":"schema-template-gallery-presentation","displayType":"card-grid","hints":"{\"columns\":3,\"showSearch\":true,\"categoryFilter\":true}"});
    await storage.put("filter", "schema-template-gallery-filter", {"name":"schema-template-gallery-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "schema-template-gallery-sort", {"name":"schema-template-gallery-sort","keys":"[{\"field\":\"label\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "schema-template-gallery-projection", {"name":"schema-template-gallery-projection","fields":"[{\"key\":\"name\",\"label\":\"Name\",\"visibility\":\"hidden\"},{\"key\":\"label\",\"label\":\"Template\"},{\"key\":\"description\",\"label\":\"Description\"},{\"key\":\"category\",\"label\":\"Category\",\"formatter\":\"badge\"},{\"key\":\"icon\",\"label\":\"Icon\",\"formatter\":\"emoji\"},{\"key\":\"fieldCount\",\"label\":\"Fields\",\"formatter\":\"number\"}]"});
    await storage.put("interaction", "schema-template-gallery-interaction", {"name":"schema-template-gallery-interaction","createForm":"{}","rowClick":"{\"action\":\"preview\"}","rowActions":"[{\"key\":\"apply\",\"concept\":\"SchemaTemplate\",\"action\":\"apply\",\"label\":\"Use Template\"},{\"key\":\"preview\",\"concept\":\"SchemaTemplate\",\"action\":\"preview\",\"label\":\"Preview\"}]"});
    await storage.put('view', "schema-template-gallery", {"name":"schema-template-gallery","title":"schema-template-gallery","description":"","dataSource":"schema-template-gallery-dataSource","filter":"schema-template-gallery-filter","sort":"schema-template-gallery-sort","group":"","projection":"schema-template-gallery-projection","presentation":"schema-template-gallery-presentation","interaction":"schema-template-gallery-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("schema-template-gallery", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only SchemaTemplate actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("SchemaTemplate/")).toBe(true);
    }
  });

  it("always: all invoke variants covered", () => {
    expect(analysis.uncoveredVariants).toEqual([]);
  });

  it("always: projects only known fields", () => {
    for (const f of analysis.projectedFields) {
      expect(["name", "label", "description", "category", "icon", "fieldCount"]).toContain(f);
    }
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
