// generated: SwiftGen/Handler.swift

import Foundation

protocol SwiftGenHandler {
    func generate(
        input: SwiftGenGenerateInput,
        storage: ConceptStorage
    ) async throws -> SwiftGenGenerateOutput

}
