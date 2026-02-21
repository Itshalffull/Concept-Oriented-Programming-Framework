// generated: Workflow/Handler.swift

import Foundation

protocol WorkflowHandler {
    func defineState(
        input: WorkflowDefineStateInput,
        storage: ConceptStorage
    ) async throws -> WorkflowDefineStateOutput

    func defineTransition(
        input: WorkflowDefineTransitionInput,
        storage: ConceptStorage
    ) async throws -> WorkflowDefineTransitionOutput

    func transition(
        input: WorkflowTransitionInput,
        storage: ConceptStorage
    ) async throws -> WorkflowTransitionOutput

    func getCurrentState(
        input: WorkflowGetCurrentStateInput,
        storage: ConceptStorage
    ) async throws -> WorkflowGetCurrentStateOutput

}
