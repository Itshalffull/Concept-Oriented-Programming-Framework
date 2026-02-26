// SessionImpl.swift — Session concept implementation

import Foundation

// MARK: - Types

public struct SessionCreateInput: Codable {
    public let userId: String
    public let deviceInfo: String

    public init(userId: String, deviceInfo: String) {
        self.userId = userId
        self.deviceInfo = deviceInfo
    }
}

public enum SessionCreateOutput: Codable {
    case ok(sessionId: String)

    enum CodingKeys: String, CodingKey {
        case variant, sessionId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(sessionId: try container.decode(String.self, forKey: .sessionId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sessionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sessionId, forKey: .sessionId)
        }
    }
}

public struct SessionValidateInput: Codable {
    public let sessionId: String

    public init(sessionId: String) {
        self.sessionId = sessionId
    }
}

public enum SessionValidateOutput: Codable {
    case ok(sessionId: String, userId: String, valid: Bool)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, sessionId, userId, valid, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sessionId: try container.decode(String.self, forKey: .sessionId),
                userId: try container.decode(String.self, forKey: .userId),
                valid: try container.decode(Bool.self, forKey: .valid)
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
        case .ok(let sessionId, let userId, let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(sessionId, forKey: .sessionId)
            try container.encode(userId, forKey: .userId)
            try container.encode(valid, forKey: .valid)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SessionRefreshInput: Codable {
    public let sessionId: String

    public init(sessionId: String) {
        self.sessionId = sessionId
    }
}

public enum SessionRefreshOutput: Codable {
    case ok(sessionId: String)
    case notfound(message: String)
    case expired(sessionId: String)

    enum CodingKeys: String, CodingKey {
        case variant, sessionId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(sessionId: try container.decode(String.self, forKey: .sessionId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        case "expired":
            self = .expired(sessionId: try container.decode(String.self, forKey: .sessionId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sessionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sessionId, forKey: .sessionId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .expired(let sessionId):
            try container.encode("expired", forKey: .variant)
            try container.encode(sessionId, forKey: .sessionId)
        }
    }
}

public struct SessionDestroyInput: Codable {
    public let sessionId: String

    public init(sessionId: String) {
        self.sessionId = sessionId
    }
}

public enum SessionDestroyOutput: Codable {
    case ok(sessionId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, sessionId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(sessionId: try container.decode(String.self, forKey: .sessionId))
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
        case .ok(let sessionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sessionId, forKey: .sessionId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SessionDestroyAllInput: Codable {
    public let userId: String

    public init(userId: String) {
        self.userId = userId
    }
}

public enum SessionDestroyAllOutput: Codable {
    case ok(userId: String, count: Int)

    enum CodingKeys: String, CodingKey {
        case variant, userId, count
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
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
        case .ok(let userId, let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(count, forKey: .count)
        }
    }
}

// MARK: - Handler Protocol

public protocol SessionHandler {
    func create(input: SessionCreateInput, storage: ConceptStorage) async throws -> SessionCreateOutput
    func validate(input: SessionValidateInput, storage: ConceptStorage) async throws -> SessionValidateOutput
    func refresh(input: SessionRefreshInput, storage: ConceptStorage) async throws -> SessionRefreshOutput
    func destroy(input: SessionDestroyInput, storage: ConceptStorage) async throws -> SessionDestroyOutput
    func destroyAll(input: SessionDestroyAllInput, storage: ConceptStorage) async throws -> SessionDestroyAllOutput
}

// MARK: - Implementation

public struct SessionHandlerImpl: SessionHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func create(
        input: SessionCreateInput,
        storage: ConceptStorage
    ) async throws -> SessionCreateOutput {
        let sessionId = UUID().uuidString
        let now = iso8601Now()
        try await storage.put(
            relation: "session",
            key: sessionId,
            value: [
                "sessionId": sessionId,
                "userId": input.userId,
                "deviceInfo": input.deviceInfo,
                "createdAt": now,
                "refreshedAt": now,
                "active": "true",
            ]
        )
        // Also track in active_session for per-user lookups
        try await storage.put(
            relation: "active_session",
            key: sessionId,
            value: [
                "sessionId": sessionId,
                "userId": input.userId,
            ]
        )
        return .ok(sessionId: sessionId)
    }

    public func validate(
        input: SessionValidateInput,
        storage: ConceptStorage
    ) async throws -> SessionValidateOutput {
        guard let record = try await storage.get(relation: "session", key: input.sessionId) else {
            return .notfound(message: "Session '\(input.sessionId)' not found")
        }
        let userId = record["userId"] as? String ?? ""
        let active = record["active"] as? String ?? "false"
        return .ok(sessionId: input.sessionId, userId: userId, valid: active == "true")
    }

    public func refresh(
        input: SessionRefreshInput,
        storage: ConceptStorage
    ) async throws -> SessionRefreshOutput {
        guard var record = try await storage.get(relation: "session", key: input.sessionId) else {
            return .notfound(message: "Session '\(input.sessionId)' not found")
        }
        let active = record["active"] as? String ?? "false"
        if active != "true" {
            return .expired(sessionId: input.sessionId)
        }
        record["refreshedAt"] = iso8601Now()
        try await storage.put(relation: "session", key: input.sessionId, value: record)
        return .ok(sessionId: input.sessionId)
    }

    public func destroy(
        input: SessionDestroyInput,
        storage: ConceptStorage
    ) async throws -> SessionDestroyOutput {
        guard try await storage.get(relation: "session", key: input.sessionId) != nil else {
            return .notfound(message: "Session '\(input.sessionId)' not found")
        }
        try await storage.del(relation: "session", key: input.sessionId)
        try await storage.del(relation: "active_session", key: input.sessionId)
        return .ok(sessionId: input.sessionId)
    }

    public func destroyAll(
        input: SessionDestroyAllInput,
        storage: ConceptStorage
    ) async throws -> SessionDestroyAllOutput {
        let activeSessions = try await storage.find(
            relation: "active_session",
            criteria: ["userId": input.userId]
        )
        var count = 0
        for session in activeSessions {
            let sessionId = session["sessionId"] as? String ?? ""
            try await storage.del(relation: "session", key: sessionId)
            try await storage.del(relation: "active_session", key: sessionId)
            count += 1
        }
        return .ok(userId: input.userId, count: count)
    }
}
