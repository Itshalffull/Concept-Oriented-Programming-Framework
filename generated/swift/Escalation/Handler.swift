// generated: Escalation/Handler.swift

import Foundation

protocol EscalationHandler {
    func escalate(
        input: EscalationEscalateInput,
        storage: ConceptStorage
    ) async throws -> EscalationEscalateOutput

    func accept(
        input: EscalationAcceptInput,
        storage: ConceptStorage
    ) async throws -> EscalationAcceptOutput

    func resolve(
        input: EscalationResolveInput,
        storage: ConceptStorage
    ) async throws -> EscalationResolveOutput

    func reEscalate(
        input: EscalationReEscalateInput,
        storage: ConceptStorage
    ) async throws -> EscalationReEscalateOutput

}
