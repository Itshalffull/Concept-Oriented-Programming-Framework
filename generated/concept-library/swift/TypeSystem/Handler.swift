// generated: TypeSystem/Handler.swift

import Foundation

protocol TypeSystemHandler {
    func registerType(
        input: TypeSystemRegisterTypeInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemRegisterTypeOutput

    func resolve(
        input: TypeSystemResolveInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemResolveOutput

    func validate(
        input: TypeSystemValidateInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemValidateOutput

    func navigate(
        input: TypeSystemNavigateInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemNavigateOutput

    func serialize(
        input: TypeSystemSerializeInput,
        storage: ConceptStorage
    ) async throws -> TypeSystemSerializeOutput

}
