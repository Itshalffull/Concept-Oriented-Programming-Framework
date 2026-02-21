// generated: Session/Handler.swift

import Foundation

protocol SessionHandler {
    func create(
        input: SessionCreateInput,
        storage: ConceptStorage
    ) async throws -> SessionCreateOutput

    func validate(
        input: SessionValidateInput,
        storage: ConceptStorage
    ) async throws -> SessionValidateOutput

    func refresh(
        input: SessionRefreshInput,
        storage: ConceptStorage
    ) async throws -> SessionRefreshOutput

    func destroy(
        input: SessionDestroyInput,
        storage: ConceptStorage
    ) async throws -> SessionDestroyOutput

    func destroyAll(
        input: SessionDestroyAllInput,
        storage: ConceptStorage
    ) async throws -> SessionDestroyAllOutput

    func getContext(
        input: SessionGetContextInput,
        storage: ConceptStorage
    ) async throws -> SessionGetContextOutput

}
