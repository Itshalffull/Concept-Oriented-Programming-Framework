// generated: machineprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./machineprovider.types";

export interface MachineProviderHandler {
  initialize(input: T.MachineProviderInitializeInput, storage: ConceptStorage):
    Promise<T.MachineProviderInitializeOutput>;
  spawn(input: T.MachineProviderSpawnInput, storage: ConceptStorage):
    Promise<T.MachineProviderSpawnOutput>;
  send(input: T.MachineProviderSendInput, storage: ConceptStorage):
    Promise<T.MachineProviderSendOutput>;
  connect(input: T.MachineProviderConnectInput, storage: ConceptStorage):
    Promise<T.MachineProviderConnectOutput>;
  destroy(input: T.MachineProviderDestroyInput, storage: ConceptStorage):
    Promise<T.MachineProviderDestroyOutput>;
}
