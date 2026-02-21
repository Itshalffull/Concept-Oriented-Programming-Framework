// generated: Pathauto/Handler.swift

import Foundation

protocol PathautoHandler {
    func generateAlias(
        input: PathautoGenerateAliasInput,
        storage: ConceptStorage
    ) async throws -> PathautoGenerateAliasOutput

    func bulkGenerate(
        input: PathautoBulkGenerateInput,
        storage: ConceptStorage
    ) async throws -> PathautoBulkGenerateOutput

    func cleanString(
        input: PathautoCleanStringInput,
        storage: ConceptStorage
    ) async throws -> PathautoCleanStringOutput

}
