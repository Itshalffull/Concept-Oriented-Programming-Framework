// generated: Control/Handler.swift

import Foundation

protocol ControlHandler {
    func create(
        input: ControlCreateInput,
        storage: ConceptStorage
    ) async throws -> ControlCreateOutput

    func interact(
        input: ControlInteractInput,
        storage: ConceptStorage
    ) async throws -> ControlInteractOutput

    func getValue(
        input: ControlGetValueInput,
        storage: ConceptStorage
    ) async throws -> ControlGetValueOutput

    func setValue(
        input: ControlSetValueInput,
        storage: ConceptStorage
    ) async throws -> ControlSetValueOutput

    func triggerAction(
        input: ControlTriggerActionInput,
        storage: ConceptStorage
    ) async throws -> ControlTriggerActionOutput

}
