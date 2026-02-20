// generated: Echo/Handler.swift

import Foundation

protocol EchoHandler {
    func send(
        input: EchoSendInput,
        storage: ConceptStorage
    ) async throws -> EchoSendOutput

}
