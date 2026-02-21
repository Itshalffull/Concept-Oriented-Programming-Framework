// generated: Reference/Handler.swift

import Foundation

protocol ReferenceHandler {
    func addRef(
        input: ReferenceAddRefInput,
        storage: ConceptStorage
    ) async throws -> ReferenceAddRefOutput

    func removeRef(
        input: ReferenceRemoveRefInput,
        storage: ConceptStorage
    ) async throws -> ReferenceRemoveRefOutput

    func getRefs(
        input: ReferenceGetRefsInput,
        storage: ConceptStorage
    ) async throws -> ReferenceGetRefsOutput

    func resolveTarget(
        input: ReferenceResolveTargetInput,
        storage: ConceptStorage
    ) async throws -> ReferenceResolveTargetOutput

}
