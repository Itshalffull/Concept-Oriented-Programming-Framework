// generated: SyncCompiler/Handler.swift

import Foundation

protocol SyncCompilerHandler {
    func compile(
        input: SyncCompilerCompileInput,
        storage: ConceptStorage
    ) async throws -> SyncCompilerCompileOutput

}
