// generated: FlowTrace/Handler.swift

import Foundation

protocol FlowTraceHandler {
    func build(
        input: FlowTraceBuildInput,
        storage: ConceptStorage
    ) async throws -> FlowTraceBuildOutput

    func render(
        input: FlowTraceRenderInput,
        storage: ConceptStorage
    ) async throws -> FlowTraceRenderOutput

}
