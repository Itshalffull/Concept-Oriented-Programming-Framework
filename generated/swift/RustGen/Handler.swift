// generated: RustGen/Handler.swift

import Foundation

protocol RustGenHandler {
    func generate(
        input: RustGenGenerateInput,
        storage: ConceptStorage
    ) async throws -> RustGenGenerateOutput

}
