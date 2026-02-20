// generated: Registry/Handler.swift

import Foundation

protocol RegistryHandler {
    func register(
        input: RegistryRegisterInput,
        storage: ConceptStorage
    ) async throws -> RegistryRegisterOutput

    func deregister(
        input: RegistryDeregisterInput,
        storage: ConceptStorage
    ) async throws -> RegistryDeregisterOutput

    func heartbeat(
        input: RegistryHeartbeatInput,
        storage: ConceptStorage
    ) async throws -> RegistryHeartbeatOutput

}
