// generated: template.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./template.types";

export interface TemplateHandler {
  define(input: T.TemplateDefineInput, storage: ConceptStorage):
    Promise<T.TemplateDefineOutput>;
  instantiate(input: T.TemplateInstantiateInput, storage: ConceptStorage):
    Promise<T.TemplateInstantiateOutput>;
  registerTrigger(input: T.TemplateRegisterTriggerInput, storage: ConceptStorage):
    Promise<T.TemplateRegisterTriggerOutput>;
  mergeProperties(input: T.TemplateMergePropertiesInput, storage: ConceptStorage):
    Promise<T.TemplateMergePropertiesOutput>;
}
