// generated: TypeScriptGen/Handler.swift

import Foundation

protocol TypeScriptGenHandler {
    func generate(
        input: TypeScriptGenGenerateInput,
        storage: ConceptStorage
    ) async throws -> TypeScriptGenGenerateOutput

}
