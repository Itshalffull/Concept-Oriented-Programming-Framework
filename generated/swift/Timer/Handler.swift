// generated: Timer/Handler.swift

import Foundation

protocol TimerHandler {
    func setTimer(
        input: TimerSetTimerInput,
        storage: ConceptStorage
    ) async throws -> TimerSetTimerOutput

    func fire(
        input: TimerFireInput,
        storage: ConceptStorage
    ) async throws -> TimerFireOutput

    func cancel(
        input: TimerCancelInput,
        storage: ConceptStorage
    ) async throws -> TimerCancelOutput

    func reset(
        input: TimerResetInput,
        storage: ConceptStorage
    ) async throws -> TimerResetOutput

}
