// generated: machine.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./machine.types";

export interface MachineHandler {
  spawn(input: T.MachineSpawnInput, storage: ConceptStorage):
    Promise<T.MachineSpawnOutput>;
  send(input: T.MachineSendInput, storage: ConceptStorage):
    Promise<T.MachineSendOutput>;
  connect(input: T.MachineConnectInput, storage: ConceptStorage):
    Promise<T.MachineConnectOutput>;
  destroy(input: T.MachineDestroyInput, storage: ConceptStorage):
    Promise<T.MachineDestroyOutput>;
}
