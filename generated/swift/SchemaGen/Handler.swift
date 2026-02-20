// generated: SchemaGen/Handler.swift

import Foundation

protocol SchemaGenHandler {
    func generate(
        input: SchemaGenGenerateInput,
        storage: ConceptStorage
    ) async throws -> SchemaGenGenerateOutput

}
