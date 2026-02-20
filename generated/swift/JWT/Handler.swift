// generated: JWT/Handler.swift

import Foundation

protocol JWTHandler {
    func generate(
        input: JWTGenerateInput,
        storage: ConceptStorage
    ) async throws -> JWTGenerateOutput

    func verify(
        input: JWTVerifyInput,
        storage: ConceptStorage
    ) async throws -> JWTVerifyOutput

}
