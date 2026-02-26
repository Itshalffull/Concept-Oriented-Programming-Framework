// generated: Formula/Handler.swift

import Foundation

protocol FormulaHandler {
    func create(
        input: FormulaCreateInput,
        storage: ConceptStorage
    ) async throws -> FormulaCreateOutput

    func evaluate(
        input: FormulaEvaluateInput,
        storage: ConceptStorage
    ) async throws -> FormulaEvaluateOutput

    func getDependencies(
        input: FormulaGetDependenciesInput,
        storage: ConceptStorage
    ) async throws -> FormulaGetDependenciesOutput

    func invalidate(
        input: FormulaInvalidateInput,
        storage: ConceptStorage
    ) async throws -> FormulaInvalidateOutput

    func setExpression(
        input: FormulaSetExpressionInput,
        storage: ConceptStorage
    ) async throws -> FormulaSetExpressionOutput

}
