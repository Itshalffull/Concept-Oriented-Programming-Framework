// generated: binding.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./binding.types";

export interface BindingHandler {
  bind(input: T.BindingBindInput, storage: ConceptStorage):
    Promise<T.BindingBindOutput>;
  sync(input: T.BindingSyncInput, storage: ConceptStorage):
    Promise<T.BindingSyncOutput>;
  invoke(input: T.BindingInvokeInput, storage: ConceptStorage):
    Promise<T.BindingInvokeOutput>;
  unbind(input: T.BindingUnbindInput, storage: ConceptStorage):
    Promise<T.BindingUnbindOutput>;
}
