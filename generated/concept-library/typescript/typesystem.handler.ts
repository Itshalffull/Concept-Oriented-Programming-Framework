// generated: typesystem.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./typesystem.types";

export interface TypeSystemHandler {
  registerType(input: T.TypeSystemRegisterTypeInput, storage: ConceptStorage):
    Promise<T.TypeSystemRegisterTypeOutput>;
  resolve(input: T.TypeSystemResolveInput, storage: ConceptStorage):
    Promise<T.TypeSystemResolveOutput>;
  validate(input: T.TypeSystemValidateInput, storage: ConceptStorage):
    Promise<T.TypeSystemValidateOutput>;
  navigate(input: T.TypeSystemNavigateInput, storage: ConceptStorage):
    Promise<T.TypeSystemNavigateOutput>;
  serialize(input: T.TypeSystemSerializeInput, storage: ConceptStorage):
    Promise<T.TypeSystemSerializeOutput>;
}
