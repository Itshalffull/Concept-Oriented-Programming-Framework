// generated: AutomationRule/Handler.swift

import Foundation

protocol AutomationRuleHandler {
    func define(
        input: AutomationRuleDefineInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleDefineOutput

    func enable(
        input: AutomationRuleEnableInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleEnableOutput

    func disable(
        input: AutomationRuleDisableInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleDisableOutput

    func evaluate(
        input: AutomationRuleEvaluateInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleEvaluateOutput

    func execute(
        input: AutomationRuleExecuteInput,
        storage: ConceptStorage
    ) async throws -> AutomationRuleExecuteOutput

}
