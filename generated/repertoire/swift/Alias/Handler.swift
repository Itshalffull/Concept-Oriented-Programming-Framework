// generated: Alias/Handler.swift

import Foundation

protocol AliasHandler {
    func addAlias(
        input: AliasAddAliasInput,
        storage: ConceptStorage
    ) async throws -> AliasAddAliasOutput

    func removeAlias(
        input: AliasRemoveAliasInput,
        storage: ConceptStorage
    ) async throws -> AliasRemoveAliasOutput

    func resolve(
        input: AliasResolveInput,
        storage: ConceptStorage
    ) async throws -> AliasResolveOutput

}
