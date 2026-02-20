// generated: frameworkadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./frameworkadapter.types";

export interface FrameworkAdapterHandler {
  register(input: T.FrameworkAdapterRegisterInput, storage: ConceptStorage):
    Promise<T.FrameworkAdapterRegisterOutput>;
  mount(input: T.FrameworkAdapterMountInput, storage: ConceptStorage):
    Promise<T.FrameworkAdapterMountOutput>;
  unmount(input: T.FrameworkAdapterUnmountInput, storage: ConceptStorage):
    Promise<T.FrameworkAdapterUnmountOutput>;
  unregister(input: T.FrameworkAdapterUnregisterInput, storage: ConceptStorage):
    Promise<T.FrameworkAdapterUnregisterOutput>;
}
