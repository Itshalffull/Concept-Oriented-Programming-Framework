// generated: property.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./property.types";

export interface PropertyHandler {
  set(input: T.PropertySetInput, storage: ConceptStorage):
    Promise<T.PropertySetOutput>;
  get(input: T.PropertyGetInput, storage: ConceptStorage):
    Promise<T.PropertyGetOutput>;
  delete(input: T.PropertyDeleteInput, storage: ConceptStorage):
    Promise<T.PropertyDeleteOutput>;
  defineType(input: T.PropertyDefineTypeInput, storage: ConceptStorage):
    Promise<T.PropertyDefineTypeOutput>;
  listAll(input: T.PropertyListAllInput, storage: ConceptStorage):
    Promise<T.PropertyListAllOutput>;
}
