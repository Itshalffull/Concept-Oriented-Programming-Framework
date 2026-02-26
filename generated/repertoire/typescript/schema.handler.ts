// generated: schema.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./schema.types";

export interface SchemaHandler {
  defineSchema(input: T.SchemaDefineSchemaInput, storage: ConceptStorage):
    Promise<T.SchemaDefineSchemaOutput>;
  addField(input: T.SchemaAddFieldInput, storage: ConceptStorage):
    Promise<T.SchemaAddFieldOutput>;
  extendSchema(input: T.SchemaExtendSchemaInput, storage: ConceptStorage):
    Promise<T.SchemaExtendSchemaOutput>;
  applyTo(input: T.SchemaApplyToInput, storage: ConceptStorage):
    Promise<T.SchemaApplyToOutput>;
  removeFrom(input: T.SchemaRemoveFromInput, storage: ConceptStorage):
    Promise<T.SchemaRemoveFromOutput>;
  getAssociations(input: T.SchemaGetAssociationsInput, storage: ConceptStorage):
    Promise<T.SchemaGetAssociationsOutput>;
  export(input: T.SchemaExportInput, storage: ConceptStorage):
    Promise<T.SchemaExportOutput>;
}
