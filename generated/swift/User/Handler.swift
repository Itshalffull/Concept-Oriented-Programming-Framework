// generated: User/Handler.swift

import Foundation

protocol UserHandler {
    func register(
        input: UserRegisterInput,
        storage: ConceptStorage
    ) async throws -> UserRegisterOutput

}
