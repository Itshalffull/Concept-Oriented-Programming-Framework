// generated: Renderer/Handler.swift

import Foundation

protocol RendererHandler {
    func render(
        input: RendererRenderInput,
        storage: ConceptStorage
    ) async throws -> RendererRenderOutput

    func autoPlaceholder(
        input: RendererAutoPlaceholderInput,
        storage: ConceptStorage
    ) async throws -> RendererAutoPlaceholderOutput

    func stream(
        input: RendererStreamInput,
        storage: ConceptStorage
    ) async throws -> RendererStreamOutput

    func mergeCacheability(
        input: RendererMergeCacheabilityInput,
        storage: ConceptStorage
    ) async throws -> RendererMergeCacheabilityOutput

}
