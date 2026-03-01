// generated: ToolRegistry/Handler.swift

import Foundation

protocol ToolRegistryHandler {
    func register(
        input: ToolRegistryRegisterInput,
        storage: ConceptStorage
    ) async throws -> ToolRegistryRegisterOutput

    func deprecate(
        input: ToolRegistryDeprecateInput,
        storage: ConceptStorage
    ) async throws -> ToolRegistryDeprecateOutput

    func disable(
        input: ToolRegistryDisableInput,
        storage: ConceptStorage
    ) async throws -> ToolRegistryDisableOutput

    func authorize(
        input: ToolRegistryAuthorizeInput,
        storage: ConceptStorage
    ) async throws -> ToolRegistryAuthorizeOutput

    func checkAccess(
        input: ToolRegistryCheckAccessInput,
        storage: ConceptStorage
    ) async throws -> ToolRegistryCheckAccessOutput

    func listActive(
        input: ToolRegistryListActiveInput,
        storage: ConceptStorage
    ) async throws -> ToolRegistryListActiveOutput

}
