// generated: bindingprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./bindingprovider.types";

export interface BindingProviderHandler {
  initialize(input: T.BindingProviderInitializeInput, storage: ConceptStorage):
    Promise<T.BindingProviderInitializeOutput>;
  bind(input: T.BindingProviderBindInput, storage: ConceptStorage):
    Promise<T.BindingProviderBindOutput>;
  sync(input: T.BindingProviderSyncInput, storage: ConceptStorage):
    Promise<T.BindingProviderSyncOutput>;
  invoke(input: T.BindingProviderInvokeInput, storage: ConceptStorage):
    Promise<T.BindingProviderInvokeOutput>;
  unbind(input: T.BindingProviderUnbindInput, storage: ConceptStorage):
    Promise<T.BindingProviderUnbindOutput>;
}
