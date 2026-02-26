// generated: control.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./control.types";

export interface ControlHandler {
  create(input: T.ControlCreateInput, storage: ConceptStorage):
    Promise<T.ControlCreateOutput>;
  interact(input: T.ControlInteractInput, storage: ConceptStorage):
    Promise<T.ControlInteractOutput>;
  getValue(input: T.ControlGetValueInput, storage: ConceptStorage):
    Promise<T.ControlGetValueOutput>;
  setValue(input: T.ControlSetValueInput, storage: ConceptStorage):
    Promise<T.ControlSetValueOutput>;
  triggerAction(input: T.ControlTriggerActionInput, storage: ConceptStorage):
    Promise<T.ControlTriggerActionOutput>;
}
