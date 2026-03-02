// generated: MachineProvider/Handler.swift

import Foundation

protocol MachineProviderHandler {
    func initialize(
        input: MachineProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderInitializeOutput

    func spawn(
        input: MachineProviderSpawnInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderSpawnOutput

    func send(
        input: MachineProviderSendInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderSendOutput

    func connect(
        input: MachineProviderConnectInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderConnectOutput

    func destroy(
        input: MachineProviderDestroyInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderDestroyOutput

}
