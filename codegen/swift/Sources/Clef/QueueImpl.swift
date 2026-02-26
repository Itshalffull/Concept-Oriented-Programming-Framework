// QueueImpl.swift — Queue concept implementation

import Foundation

// MARK: - Types

public struct QueueEnqueueInput: Codable {
    public let queueId: String
    public let data: String

    public init(queueId: String, data: String) {
        self.queueId = queueId
        self.data = data
    }
}

public enum QueueEnqueueOutput: Codable {
    case ok(itemId: String)

    enum CodingKeys: String, CodingKey {
        case variant, itemId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(itemId: try container.decode(String.self, forKey: .itemId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let itemId):
            try container.encode("ok", forKey: .variant)
            try container.encode(itemId, forKey: .itemId)
        }
    }
}

public struct QueueClaimInput: Codable {
    public let queueId: String

    public init(queueId: String) {
        self.queueId = queueId
    }
}

public enum QueueClaimOutput: Codable {
    case ok(itemId: String, data: String)
    case empty(queueId: String)

    enum CodingKeys: String, CodingKey {
        case variant, itemId, data, queueId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                itemId: try container.decode(String.self, forKey: .itemId),
                data: try container.decode(String.self, forKey: .data)
            )
        case "empty":
            self = .empty(queueId: try container.decode(String.self, forKey: .queueId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let itemId, let data):
            try container.encode("ok", forKey: .variant)
            try container.encode(itemId, forKey: .itemId)
            try container.encode(data, forKey: .data)
        case .empty(let queueId):
            try container.encode("empty", forKey: .variant)
            try container.encode(queueId, forKey: .queueId)
        }
    }
}

public struct QueueReleaseInput: Codable {
    public let itemId: String

    public init(itemId: String) {
        self.itemId = itemId
    }
}

public enum QueueReleaseOutput: Codable {
    case ok(itemId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, itemId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(itemId: try container.decode(String.self, forKey: .itemId))
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
        case .ok(let itemId):
            try container.encode("ok", forKey: .variant)
            try container.encode(itemId, forKey: .itemId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct QueueDeleteItemInput: Codable {
    public let itemId: String

    public init(itemId: String) {
        self.itemId = itemId
    }
}

public enum QueueDeleteItemOutput: Codable {
    case ok(itemId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, itemId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(itemId: try container.decode(String.self, forKey: .itemId))
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
        case .ok(let itemId):
            try container.encode("ok", forKey: .variant)
            try container.encode(itemId, forKey: .itemId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol QueueHandler {
    func enqueue(input: QueueEnqueueInput, storage: ConceptStorage) async throws -> QueueEnqueueOutput
    func claim(input: QueueClaimInput, storage: ConceptStorage) async throws -> QueueClaimOutput
    func release(input: QueueReleaseInput, storage: ConceptStorage) async throws -> QueueReleaseOutput
    func deleteItem(input: QueueDeleteItemInput, storage: ConceptStorage) async throws -> QueueDeleteItemOutput
}

// MARK: - Implementation

public struct QueueHandlerImpl: QueueHandler {
    public init() {}

    public func enqueue(
        input: QueueEnqueueInput,
        storage: ConceptStorage
    ) async throws -> QueueEnqueueOutput {
        let itemId = UUID().uuidString
        try await storage.put(
            relation: "queue_item",
            key: itemId,
            value: [
                "itemId": itemId,
                "queueId": input.queueId,
                "data": input.data,
                "status": "pending",
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(itemId: itemId)
    }

    public func claim(
        input: QueueClaimInput,
        storage: ConceptStorage
    ) async throws -> QueueClaimOutput {
        let items = try await storage.find(
            relation: "queue_item",
            criteria: ["queueId": input.queueId, "status": "pending"]
        )
        guard let first = items.first else {
            return .empty(queueId: input.queueId)
        }
        let itemId = first["itemId"] as? String ?? ""
        let data = first["data"] as? String ?? ""
        var updated = first
        updated["status"] = "claimed"
        updated["claimedAt"] = ISO8601DateFormatter().string(from: Date())
        try await storage.put(relation: "queue_item", key: itemId, value: updated)
        return .ok(itemId: itemId, data: data)
    }

    public func release(
        input: QueueReleaseInput,
        storage: ConceptStorage
    ) async throws -> QueueReleaseOutput {
        guard var record = try await storage.get(relation: "queue_item", key: input.itemId) else {
            return .notfound(message: "Item \(input.itemId) not found")
        }
        record["status"] = "pending"
        record.removeValue(forKey: "claimedAt")
        try await storage.put(relation: "queue_item", key: input.itemId, value: record)
        return .ok(itemId: input.itemId)
    }

    public func deleteItem(
        input: QueueDeleteItemInput,
        storage: ConceptStorage
    ) async throws -> QueueDeleteItemOutput {
        guard try await storage.get(relation: "queue_item", key: input.itemId) != nil else {
            return .notfound(message: "Item \(input.itemId) not found")
        }
        try await storage.del(relation: "queue_item", key: input.itemId)
        return .ok(itemId: input.itemId)
    }
}
