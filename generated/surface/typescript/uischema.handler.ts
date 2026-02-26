// generated: uischema.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./uischema.types";

export interface UISchemaHandler {
  inspect(input: T.UISchemaInspectInput, storage: ConceptStorage):
    Promise<T.UISchemaInspectOutput>;
  override(input: T.UISchemaOverrideInput, storage: ConceptStorage):
    Promise<T.UISchemaOverrideOutput>;
  getSchema(input: T.UISchemaGetSchemaInput, storage: ConceptStorage):
    Promise<T.UISchemaGetSchemaOutput>;
  getElements(input: T.UISchemaGetElementsInput, storage: ConceptStorage):
    Promise<T.UISchemaGetElementsOutput>;
}
