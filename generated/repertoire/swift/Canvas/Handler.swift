// generated: Canvas/Handler.swift

import Foundation

protocol CanvasHandler {
    func addNode(
        input: CanvasAddNodeInput,
        storage: ConceptStorage
    ) async throws -> CanvasAddNodeOutput

    func moveNode(
        input: CanvasMoveNodeInput,
        storage: ConceptStorage
    ) async throws -> CanvasMoveNodeOutput

    func connectNodes(
        input: CanvasConnectNodesInput,
        storage: ConceptStorage
    ) async throws -> CanvasConnectNodesOutput

    func groupNodes(
        input: CanvasGroupNodesInput,
        storage: ConceptStorage
    ) async throws -> CanvasGroupNodesOutput

    func embedFile(
        input: CanvasEmbedFileInput,
        storage: ConceptStorage
    ) async throws -> CanvasEmbedFileOutput

}
