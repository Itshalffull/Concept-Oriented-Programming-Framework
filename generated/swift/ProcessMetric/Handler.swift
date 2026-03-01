// generated: ProcessMetric/Handler.swift

import Foundation

protocol ProcessMetricHandler {
    func record(
        input: ProcessMetricRecordInput,
        storage: ConceptStorage
    ) async throws -> ProcessMetricRecordOutput

    func query(
        input: ProcessMetricQueryInput,
        storage: ConceptStorage
    ) async throws -> ProcessMetricQueryOutput

    func aggregate(
        input: ProcessMetricAggregateInput,
        storage: ConceptStorage
    ) async throws -> ProcessMetricAggregateOutput

}
