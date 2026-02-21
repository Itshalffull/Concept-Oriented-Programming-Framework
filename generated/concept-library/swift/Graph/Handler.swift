// generated: Graph/Handler.swift

import Foundation

protocol GraphHandler {
    func addNode(
        input: GraphAddNodeInput,
        storage: ConceptStorage
    ) async throws -> GraphAddNodeOutput

    func removeNode(
        input: GraphRemoveNodeInput,
        storage: ConceptStorage
    ) async throws -> GraphRemoveNodeOutput

    func addEdge(
        input: GraphAddEdgeInput,
        storage: ConceptStorage
    ) async throws -> GraphAddEdgeOutput

    func removeEdge(
        input: GraphRemoveEdgeInput,
        storage: ConceptStorage
    ) async throws -> GraphRemoveEdgeOutput

    func computeLayout(
        input: GraphComputeLayoutInput,
        storage: ConceptStorage
    ) async throws -> GraphComputeLayoutOutput

    func getNeighbors(
        input: GraphGetNeighborsInput,
        storage: ConceptStorage
    ) async throws -> GraphGetNeighborsOutput

    func filterNodes(
        input: GraphFilterNodesInput,
        storage: ConceptStorage
    ) async throws -> GraphFilterNodesOutput

}
