// NotificationImpl.swift — Notification concept implementation

import Foundation

// MARK: - Types

public struct NotificationRegisterChannelInput: Codable {
    public let channelId: String
    public let deliveryConfig: String

    public init(channelId: String, deliveryConfig: String) {
        self.channelId = channelId
        self.deliveryConfig = deliveryConfig
    }
}

public enum NotificationRegisterChannelOutput: Codable {
    case ok(channelId: String)

    enum CodingKeys: String, CodingKey {
        case variant, channelId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(channelId: try container.decode(String.self, forKey: .channelId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let channelId):
            try container.encode("ok", forKey: .variant)
            try container.encode(channelId, forKey: .channelId)
        }
    }
}

public struct NotificationSubscribeInput: Codable {
    public let userId: String
    public let eventPattern: String
    public let channelIds: String

    public init(userId: String, eventPattern: String, channelIds: String) {
        self.userId = userId
        self.eventPattern = eventPattern
        self.channelIds = channelIds
    }
}

public enum NotificationSubscribeOutput: Codable {
    case ok(userId: String, eventPattern: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, eventPattern
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                eventPattern: try container.decode(String.self, forKey: .eventPattern)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId, let eventPattern):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(eventPattern, forKey: .eventPattern)
        }
    }
}

public struct NotificationNotifyInput: Codable {
    public let userId: String
    public let eventType: String
    public let context: String

    public init(userId: String, eventType: String, context: String) {
        self.userId = userId
        self.eventType = eventType
        self.context = context
    }
}

public enum NotificationNotifyOutput: Codable {
    case ok(notificationId: String)

    enum CodingKeys: String, CodingKey {
        case variant, notificationId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(notificationId: try container.decode(String.self, forKey: .notificationId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let notificationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(notificationId, forKey: .notificationId)
        }
    }
}

public struct NotificationMarkReadInput: Codable {
    public let notificationId: String

    public init(notificationId: String) {
        self.notificationId = notificationId
    }
}

public enum NotificationMarkReadOutput: Codable {
    case ok(notificationId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, notificationId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(notificationId: try container.decode(String.self, forKey: .notificationId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let notificationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(notificationId, forKey: .notificationId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct NotificationGetUnreadInput: Codable {
    public let userId: String

    public init(userId: String) {
        self.userId = userId
    }
}

public enum NotificationGetUnreadOutput: Codable {
    case ok(userId: String, notifications: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, notifications
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                notifications: try container.decode(String.self, forKey: .notifications)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId, let notifications):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(notifications, forKey: .notifications)
        }
    }
}

// MARK: - Handler Protocol

public protocol NotificationHandler {
    func registerChannel(input: NotificationRegisterChannelInput, storage: ConceptStorage) async throws -> NotificationRegisterChannelOutput
    func subscribe(input: NotificationSubscribeInput, storage: ConceptStorage) async throws -> NotificationSubscribeOutput
    func notify(input: NotificationNotifyInput, storage: ConceptStorage) async throws -> NotificationNotifyOutput
    func markRead(input: NotificationMarkReadInput, storage: ConceptStorage) async throws -> NotificationMarkReadOutput
    func getUnread(input: NotificationGetUnreadInput, storage: ConceptStorage) async throws -> NotificationGetUnreadOutput
}

// MARK: - Implementation

public struct NotificationHandlerImpl: NotificationHandler {
    public init() {}

    public func registerChannel(
        input: NotificationRegisterChannelInput,
        storage: ConceptStorage
    ) async throws -> NotificationRegisterChannelOutput {
        try await storage.put(
            relation: "notification_channel",
            key: input.channelId,
            value: [
                "channelId": input.channelId,
                "deliveryConfig": input.deliveryConfig,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(channelId: input.channelId)
    }

    public func subscribe(
        input: NotificationSubscribeInput,
        storage: ConceptStorage
    ) async throws -> NotificationSubscribeOutput {
        let subKey = "\(input.userId):\(input.eventPattern)"
        try await storage.put(
            relation: "notification_subscription",
            key: subKey,
            value: [
                "userId": input.userId,
                "eventPattern": input.eventPattern,
                "channelIds": input.channelIds,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(userId: input.userId, eventPattern: input.eventPattern)
    }

    public func notify(
        input: NotificationNotifyInput,
        storage: ConceptStorage
    ) async throws -> NotificationNotifyOutput {
        let notificationId = UUID().uuidString
        try await storage.put(
            relation: "notification_inbox",
            key: notificationId,
            value: [
                "notificationId": notificationId,
                "userId": input.userId,
                "eventType": input.eventType,
                "context": input.context,
                "read": false,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(notificationId: notificationId)
    }

    public func markRead(
        input: NotificationMarkReadInput,
        storage: ConceptStorage
    ) async throws -> NotificationMarkReadOutput {
        guard var record = try await storage.get(relation: "notification_inbox", key: input.notificationId) else {
            return .notfound(message: "Notification \(input.notificationId) not found")
        }
        record["read"] = true
        record["readAt"] = ISO8601DateFormatter().string(from: Date())
        try await storage.put(relation: "notification_inbox", key: input.notificationId, value: record)
        return .ok(notificationId: input.notificationId)
    }

    public func getUnread(
        input: NotificationGetUnreadInput,
        storage: ConceptStorage
    ) async throws -> NotificationGetUnreadOutput {
        let allNotifications = try await storage.find(
            relation: "notification_inbox",
            criteria: ["userId": input.userId]
        )
        var unread: [[String: String]] = []
        for notification in allNotifications {
            let isRead = notification["read"] as? Bool ?? false
            if !isRead {
                unread.append([
                    "notificationId": notification["notificationId"] as? String ?? "",
                    "eventType": notification["eventType"] as? String ?? "",
                    "context": notification["context"] as? String ?? "",
                    "createdAt": notification["createdAt"] as? String ?? "",
                ])
            }
        }
        let jsonData = try JSONSerialization.data(withJSONObject: unread, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .ok(userId: input.userId, notifications: jsonString)
    }
}
