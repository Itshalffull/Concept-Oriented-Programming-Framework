// generated: Component/Handler.swift

import Foundation

protocol ComponentHandler {
    func register(
        input: ComponentRegisterInput,
        storage: ConceptStorage
    ) async throws -> ComponentRegisterOutput

    func render(
        input: ComponentRenderInput,
        storage: ConceptStorage
    ) async throws -> ComponentRenderOutput

    func place(
        input: ComponentPlaceInput,
        storage: ConceptStorage
    ) async throws -> ComponentPlaceOutput

    func setVisibility(
        input: ComponentSetVisibilityInput,
        storage: ConceptStorage
    ) async throws -> ComponentSetVisibilityOutput

    func evaluateVisibility(
        input: ComponentEvaluateVisibilityInput,
        storage: ConceptStorage
    ) async throws -> ComponentEvaluateVisibilityOutput

}
