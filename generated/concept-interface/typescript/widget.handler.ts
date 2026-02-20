// generated: widget.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./widget.types";

export interface WidgetHandler {
  register(input: T.WidgetRegisterInput, storage: ConceptStorage):
    Promise<T.WidgetRegisterOutput>;
  configure(input: T.WidgetConfigureInput, storage: ConceptStorage):
    Promise<T.WidgetConfigureOutput>;
  get(input: T.WidgetGetInput, storage: ConceptStorage):
    Promise<T.WidgetGetOutput>;
  list(input: T.WidgetListInput, storage: ConceptStorage):
    Promise<T.WidgetListOutput>;
  unregister(input: T.WidgetUnregisterInput, storage: ConceptStorage):
    Promise<T.WidgetUnregisterOutput>;
}
