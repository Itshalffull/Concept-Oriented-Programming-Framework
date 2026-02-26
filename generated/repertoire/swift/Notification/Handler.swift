// generated: Notification/Handler.swift

import Foundation

protocol NotificationHandler {
    func registerChannel(
        input: NotificationRegisterChannelInput,
        storage: ConceptStorage
    ) async throws -> NotificationRegisterChannelOutput

    func defineTemplate(
        input: NotificationDefineTemplateInput,
        storage: ConceptStorage
    ) async throws -> NotificationDefineTemplateOutput

    func subscribe(
        input: NotificationSubscribeInput,
        storage: ConceptStorage
    ) async throws -> NotificationSubscribeOutput

    func unsubscribe(
        input: NotificationUnsubscribeInput,
        storage: ConceptStorage
    ) async throws -> NotificationUnsubscribeOutput

    func notify(
        input: NotificationNotifyInput,
        storage: ConceptStorage
    ) async throws -> NotificationNotifyOutput

    func markRead(
        input: NotificationMarkReadInput,
        storage: ConceptStorage
    ) async throws -> NotificationMarkReadOutput

    func getUnread(
        input: NotificationGetUnreadInput,
        storage: ConceptStorage
    ) async throws -> NotificationGetUnreadOutput

}
