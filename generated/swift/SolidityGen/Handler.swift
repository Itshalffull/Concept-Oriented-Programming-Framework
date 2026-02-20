// generated: SolidityGen/Handler.swift

import Foundation

protocol SolidityGenHandler {
    func generate(
        input: SolidityGenGenerateInput,
        storage: ConceptStorage
    ) async throws -> SolidityGenGenerateOutput

}
