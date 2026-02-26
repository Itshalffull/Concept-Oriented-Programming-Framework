// EventBusImpl.swift — EventBus concept implementation

import Foundation

// MARK: - Types

public struct EventBusRegisterEventTypeInput: Codable {
    public let eventTypeId: String
    public let payloadSchema: String

    public init(eventTypeId: String, payloadSchema: String) {
        self.eventTypeId = eventTypeId
        self.payloadSchema = payloadSchema
    }
}

public enum EventBusRegisterEventTypeOutput: Codable {
    case ok(eventTypeId: String)

    enum CodingKeys: String, CodingKey {
        case variant, eventTypeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(eventTypeId: try container.decode(String.self, forKey: .eventTypeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let eventTypeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(eventTypeId, forKey: .eventTypeId)
        }
    }
}

public struct EventBusSubscribeInput: Codable {
    public let eventTypeId: String
    public let listenerId: String
    public let priority: Int

    public init(eventTypeId: String, listenerId: String, priority: Int) {
        self.eventTypeId = eventTypeId
        self.listenerId = listenerId
        self.priority = priority
    }
}

public enum EventBusSubscribeOutput: Codable {
    case ok(eventTypeId: String, listenerId: String)

    enum CodingKeys: String, CodingKey {
        case variant, eventTypeId, listenerId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eventTypeId: try container.decode(String.self, forKey: .eventTypeId),
                listenerId: try container.decode(String.self, forKey: .listenerId)
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
        case .ok(let eventTypeId, let listenerId):
            try container.encode("ok", forKey: .variant)
            try container.encode(eventTypeId, forKey: .eventTypeId)
            try container.encode(listenerId, forKey: .listenerId)
        }
    }
}

public struct EventBusUnsubscribeInput: Codable {
    public let eventTypeId: String
    public let listenerId: String

    public init(eventTypeId: String, listenerId: String) {
        self.eventTypeId = eventTypeId
        self.listenerId = listenerId
    }
}

public enum EventBusUnsubscribeOutput: Codable {
    case ok(eventTypeId: String, listenerId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, eventTypeId, listenerId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eventTypeId: try container.decode(String.self, forKey: .eventTypeId),
                listenerId: try container.decode(String.self, forKey: .listenerId)
            )
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
        case .ok(let eventTypeId, let listenerId):
            try container.encode("ok", forKey: .variant)
            try container.encode(eventTypeId, forKey: .eventTypeId)
            try container.encode(listenerId, forKey: .listenerId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct EventBusDispatchInput: Codable {
    public let eventTypeId: String
    public let payload: String

    public init(eventTypeId: String, payload: String) {
        self.eventTypeId = eventTypeId
        self.payload = payload
    }
}

public enum EventBusDispatchOutput: Codable {
    case ok(eventTypeId: String, listenerCount: Int)

    enum CodingKeys: String, CodingKey {
        case variant, eventTypeId, listenerCount
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eventTypeId: try container.decode(String.self, forKey: .eventTypeId),
                listenerCount: try container.decode(Int.self, forKey: .listenerCount)
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
        case .ok(let eventTypeId, let listenerCount):
            try container.encode("ok", forKey: .variant)
            try container.encode(eventTypeId, forKey: .eventTypeId)
            try container.encode(listenerCount, forKey: .listenerCount)
        }
    }
}

public struct EventBusGetHistoryInput: Codable {
    public let eventTypeId: String
    public let since: String

    public init(eventTypeId: String, since: String) {
        self.eventTypeId = eventTypeId
        self.since = since
    }
}

public enum EventBusGetHistoryOutput: Codable {
    case ok(events: String)

    enum CodingKeys: String, CodingKey {
        case variant, events
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(events: try container.decode(String.self, forKey: .events))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let events):
            try container.encode("ok", forKey: .variant)
            try container.encode(events, forKey: .events)
        }
    }
}

// MARK: - Handler Protocol

public protocol EventBusHandler {
    func registerEventType(input: EventBusRegisterEventTypeInput, storage: ConceptStorage) async throws -> EventBusRegisterEventTypeOutput
    func subscribe(input: EventBusSubscribeInput, storage: ConceptStorage) async throws -> EventBusSubscribeOutput
    func unsubscribe(input: EventBusUnsubscribeInput, storage: ConceptStorage) async throws -> EventBusUnsubscribeOutput
    func dispatch(input: EventBusDispatchInput, storage: ConceptStorage) async throws -> EventBusDispatchOutput
    func getHistory(input: EventBusGetHistoryInput, storage: ConceptStorage) async throws -> EventBusGetHistoryOutput
}

// MARK: - Implementation

public struct EventBusHandlerImpl: EventBusHandler {
    public init() {}

    public func registerEventType(
        input: EventBusRegisterEventTypeInput,
        storage: ConceptStorage
    ) async throws -> EventBusRegisterEventTypeOutput {
        try await storage.put(
            relation: "event_type",
            key: input.eventTypeId,
            value: [
                "eventTypeId": input.eventTypeId,
                "payloadSchema": input.payloadSchema,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(eventTypeId: input.eventTypeId)
    }

    public func subscribe(
        input: EventBusSubscribeInput,
        storage: ConceptStorage
    ) async throws -> EventBusSubscribeOutput {
        let listenerKey = "\(input.eventTypeId):\(input.listenerId)"
        try await storage.put(
            relation: "listener",
            key: listenerKey,
            value: [
                "eventTypeId": input.eventTypeId,
                "listenerId": input.listenerId,
                "priority": input.priority,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(eventTypeId: input.eventTypeId, listenerId: input.listenerId)
    }

    public func unsubscribe(
        input: EventBusUnsubscribeInput,
        storage: ConceptStorage
    ) async throws -> EventBusUnsubscribeOutput {
        let listenerKey = "\(input.eventTypeId):\(input.listenerId)"
        guard try await storage.get(relation: "listener", key: listenerKey) != nil else {
            return .notfound(message: "Listener \(input.listenerId) for event \(input.eventTypeId) not found")
        }
        try await storage.del(relation: "listener", key: listenerKey)
        return .ok(eventTypeId: input.eventTypeId, listenerId: input.listenerId)
    }

    public func dispatch(
        input: EventBusDispatchInput,
        storage: ConceptStorage
    ) async throws -> EventBusDispatchOutput {
        let listeners = try await storage.find(
            relation: "listener",
            criteria: ["eventTypeId": input.eventTypeId]
        )
        let listenerCount = listeners.count

        // Record event in history
        let eventId = UUID().uuidString
        try await storage.put(
            relation: "event_history",
            key: eventId,
            value: [
                "eventId": eventId,
                "eventTypeId": input.eventTypeId,
                "payload": input.payload,
                "listenerCount": listenerCount,
                "dispatchedAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )

        return .ok(eventTypeId: input.eventTypeId, listenerCount: listenerCount)
    }

    public func getHistory(
        input: EventBusGetHistoryInput,
        storage: ConceptStorage
    ) async throws -> EventBusGetHistoryOutput {
        let allEvents = try await storage.find(
            relation: "event_history",
            criteria: ["eventTypeId": input.eventTypeId]
        )
        var filtered: [[String: String]] = []
        for event in allEvents {
            let dispatchedAt = event["dispatchedAt"] as? String ?? ""
            if dispatchedAt >= input.since {
                filtered.append([
                    "eventId": event["eventId"] as? String ?? "",
                    "eventTypeId": event["eventTypeId"] as? String ?? "",
                    "payload": event["payload"] as? String ?? "",
                    "dispatchedAt": dispatchedAt,
                ])
            }
        }
        let jsonData = try JSONSerialization.data(withJSONObject: filtered, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .ok(events: jsonString)
    }
}
