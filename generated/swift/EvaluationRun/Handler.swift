// generated: EvaluationRun/Handler.swift

import Foundation

protocol EvaluationRunHandler {
    func runEval(
        input: EvaluationRunRunEvalInput,
        storage: ConceptStorage
    ) async throws -> EvaluationRunRunEvalOutput

    func logMetric(
        input: EvaluationRunLogMetricInput,
        storage: ConceptStorage
    ) async throws -> EvaluationRunLogMetricOutput

    func pass(
        input: EvaluationRunPassInput,
        storage: ConceptStorage
    ) async throws -> EvaluationRunPassOutput

    func fail(
        input: EvaluationRunFailInput,
        storage: ConceptStorage
    ) async throws -> EvaluationRunFailOutput

    func getResult(
        input: EvaluationRunGetResultInput,
        storage: ConceptStorage
    ) async throws -> EvaluationRunGetResultOutput

}
