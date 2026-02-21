// CollaborationFlagImpl.swift — CollaborationFlag concept implementation

import Foundation

// MARK: - Types

public struct CollaborationFlagFlagInput: Codable {
    public let userId: String
    public let entityId: String
    public let flagType: String

    public init(userId: String, entityId: String, flagType: String) {
        self.userId = userId
        self.entityId = entityId
        self.flagType = flagType
    }
}

public enum CollaborationFlagFlagOutput: Codable {
    case ok(userId: String, entityId: String, flagType: String)
    case alreadyFlagged(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, entityId, flagType, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                entityId: try container.decode(String.self, forKey: .entityId),
                flagType: try container.decode(String.self, forKey: .flagType)
            )
        case "alreadyFlagged":
            self = .alreadyFlagged(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId, let entityId, let flagType):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(flagType, forKey: .flagType)
        case .alreadyFlagged(let message):
            try container.encode("alreadyFlagged", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct CollaborationFlagUnflagInput: Codable {
    public let userId: String
    public let entityId: String
    public let flagType: String

    public init(userId: String, entityId: String, flagType: String) {
        self.userId = userId
        self.entityId = entityId
        self.flagType = flagType
    }
}

public enum CollaborationFlagUnflagOutput: Codable {
    case ok(userId: String, entityId: String, flagType: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, entityId, flagType, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                entityId: try container.decode(String.self, forKey: .entityId),
                flagType: try container.decode(String.self, forKey: .flagType)
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
        case .ok(let userId, let entityId, let flagType):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(flagType, forKey: .flagType)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct CollaborationFlagIsFlaggedInput: Codable {
    public let userId: String
    public let entityId: String
    public let flagType: String

    public init(userId: String, entityId: String, flagType: String) {
        self.userId = userId
        self.entityId = entityId
        self.flagType = flagType
    }
}

public enum CollaborationFlagIsFlaggedOutput: Codable {
    case ok(flagged: Bool)

    enum CodingKeys: String, CodingKey {
        case variant, flagged
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(flagged: try container.decode(Bool.self, forKey: .flagged))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let flagged):
            try container.encode("ok", forKey: .variant)
            try container.encode(flagged, forKey: .flagged)
        }
    }
}

public struct CollaborationFlagGetCountInput: Codable {
    public let entityId: String
    public let flagType: String

    public init(entityId: String, flagType: String) {
        self.entityId = entityId
        self.flagType = flagType
    }
}

public enum CollaborationFlagGetCountOutput: Codable {
    case ok(entityId: String, count: Int)

    enum CodingKeys: String, CodingKey {
        case variant, entityId, count
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                count: try container.decode(Int.self, forKey: .count)
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
        case .ok(let entityId, let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(count, forKey: .count)
        }
    }
}

// MARK: - Handler Protocol

public protocol CollaborationFlagHandler {
    func flag(input: CollaborationFlagFlagInput, storage: ConceptStorage) async throws -> CollaborationFlagFlagOutput
    func unflag(input: CollaborationFlagUnflagInput, storage: ConceptStorage) async throws -> CollaborationFlagUnflagOutput
    func isFlagged(input: CollaborationFlagIsFlaggedInput, storage: ConceptStorage) async throws -> CollaborationFlagIsFlaggedOutput
    func getCount(input: CollaborationFlagGetCountInput, storage: ConceptStorage) async throws -> CollaborationFlagGetCountOutput
}

// MARK: - Implementation

public struct CollaborationFlagHandlerImpl: CollaborationFlagHandler {
    public init() {}

    public func flag(
        input: CollaborationFlagFlagInput,
        storage: ConceptStorage
    ) async throws -> CollaborationFlagFlagOutput {
        let flagKey = "\(input.userId):\(input.entityId):\(input.flagType)"
        if try await storage.get(relation: "flagging", key: flagKey) != nil {
            return .alreadyFlagged(message: "User \(input.userId) already flagged \(input.entityId) as \(input.flagType)")
        }

        // Ensure flag type exists
        let existing = try await storage.get(relation: "flag_type", key: input.flagType)
        if existing == nil {
            try await storage.put(
                relation: "flag_type",
                key: input.flagType,
                value: [
                    "flagType": input.flagType,
                    "createdAt": ISO8601DateFormatter().string(from: Date()),
                ]
            )
        }

        try await storage.put(
            relation: "flagging",
            key: flagKey,
            value: [
                "userId": input.userId,
                "entityId": input.entityId,
                "flagType": input.flagType,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(userId: input.userId, entityId: input.entityId, flagType: input.flagType)
    }

    public func unflag(
        input: CollaborationFlagUnflagInput,
        storage: ConceptStorage
    ) async throws -> CollaborationFlagUnflagOutput {
        let flagKey = "\(input.userId):\(input.entityId):\(input.flagType)"
        guard try await storage.get(relation: "flagging", key: flagKey) != nil else {
            return .notfound(message: "Flagging not found for user \(input.userId) on \(input.entityId) as \(input.flagType)")
        }
        try await storage.del(relation: "flagging", key: flagKey)
        return .ok(userId: input.userId, entityId: input.entityId, flagType: input.flagType)
    }

    public func isFlagged(
        input: CollaborationFlagIsFlaggedInput,
        storage: ConceptStorage
    ) async throws -> CollaborationFlagIsFlaggedOutput {
        let flagKey = "\(input.userId):\(input.entityId):\(input.flagType)"
        let record = try await storage.get(relation: "flagging", key: flagKey)
        return .ok(flagged: record != nil)
    }

    public func getCount(
        input: CollaborationFlagGetCountInput,
        storage: ConceptStorage
    ) async throws -> CollaborationFlagGetCountOutput {
        let allFlaggings = try await storage.find(
            relation: "flagging",
            criteria: ["entityId": input.entityId, "flagType": input.flagType]
        )
        return .ok(entityId: input.entityId, count: allFlaggings.count)
    }
}
