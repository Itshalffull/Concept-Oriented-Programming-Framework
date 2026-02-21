// generated: ExpressionLanguage/Handler.swift

import Foundation

protocol ExpressionLanguageHandler {
    func registerLanguage(
        input: ExpressionLanguageRegisterLanguageInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageRegisterLanguageOutput

    func registerFunction(
        input: ExpressionLanguageRegisterFunctionInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageRegisterFunctionOutput

    func registerOperator(
        input: ExpressionLanguageRegisterOperatorInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageRegisterOperatorOutput

    func parse(
        input: ExpressionLanguageParseInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageParseOutput

    func evaluate(
        input: ExpressionLanguageEvaluateInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageEvaluateOutput

    func typeCheck(
        input: ExpressionLanguageTypeCheckInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageTypeCheckOutput

    func getCompletions(
        input: ExpressionLanguageGetCompletionsInput,
        storage: ConceptStorage
    ) async throws -> ExpressionLanguageGetCompletionsOutput

}
