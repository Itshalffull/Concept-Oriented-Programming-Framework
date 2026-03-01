// generated: WebhookInbox/Handler.swift

import Foundation

protocol WebhookInboxHandler {
    func register(
        input: WebhookInboxRegisterInput,
        storage: ConceptStorage
    ) async throws -> WebhookInboxRegisterOutput

    func receive(
        input: WebhookInboxReceiveInput,
        storage: ConceptStorage
    ) async throws -> WebhookInboxReceiveOutput

    func expire(
        input: WebhookInboxExpireInput,
        storage: ConceptStorage
    ) async throws -> WebhookInboxExpireOutput

    func ack(
        input: WebhookInboxAckInput,
        storage: ConceptStorage
    ) async throws -> WebhookInboxAckOutput

}
