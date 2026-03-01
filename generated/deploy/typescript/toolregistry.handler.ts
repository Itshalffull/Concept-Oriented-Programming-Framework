// generated: toolregistry.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./toolregistry.types";

export interface ToolRegistryHandler {
  register(input: T.ToolRegistryRegisterInput, storage: ConceptStorage):
    Promise<T.ToolRegistryRegisterOutput>;
  deprecate(input: T.ToolRegistryDeprecateInput, storage: ConceptStorage):
    Promise<T.ToolRegistryDeprecateOutput>;
  disable(input: T.ToolRegistryDisableInput, storage: ConceptStorage):
    Promise<T.ToolRegistryDisableOutput>;
  authorize(input: T.ToolRegistryAuthorizeInput, storage: ConceptStorage):
    Promise<T.ToolRegistryAuthorizeOutput>;
  checkAccess(input: T.ToolRegistryCheckAccessInput, storage: ConceptStorage):
    Promise<T.ToolRegistryCheckAccessOutput>;
  listActive(input: T.ToolRegistryListActiveInput, storage: ConceptStorage):
    Promise<T.ToolRegistryListActiveOutput>;
}
