// IntentImpl.swift — Intent concept implementation

import Foundation

// MARK: - Types

public struct IntentDefineInput: Codable {
    public let targetId: String
    public let purpose: String
    public let principles: String
    public let description: String

    public init(targetId: String, purpose: String, principles: String, description: String) {
        self.targetId = targetId
        self.purpose = purpose
        self.principles = principles
        self.description = description
    }
}

public enum IntentDefineOutput: Codable {
    case ok(targetId: String)

    enum CodingKeys: String, CodingKey {
        case variant, targetId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(targetId: try container.decode(String.self, forKey: .targetId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let targetId):
            try container.encode("ok", forKey: .variant)
            try container.encode(targetId, forKey: .targetId)
        }
    }
}

public struct IntentUpdateInput: Codable {
    public let targetId: String
    public let changes: String

    public init(targetId: String, changes: String) {
        self.targetId = targetId
        self.changes = changes
    }
}

public enum IntentUpdateOutput: Codable {
    case ok(targetId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, targetId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(targetId: try container.decode(String.self, forKey: .targetId))
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
        case .ok(let targetId):
            try container.encode("ok", forKey: .variant)
            try container.encode(targetId, forKey: .targetId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct IntentVerifyInput: Codable {
    public let targetId: String

    public init(targetId: String) {
        self.targetId = targetId
    }
}

public enum IntentVerifyOutput: Codable {
    case ok(targetId: String, passed: String, failed: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, targetId, passed, failed, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                targetId: try container.decode(String.self, forKey: .targetId),
                passed: try container.decode(String.self, forKey: .passed),
                failed: try container.decode(String.self, forKey: .failed)
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
        case .ok(let targetId, let passed, let failed):
            try container.encode("ok", forKey: .variant)
            try container.encode(targetId, forKey: .targetId)
            try container.encode(passed, forKey: .passed)
            try container.encode(failed, forKey: .failed)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct IntentDiscoverInput: Codable {
    public let query: String

    public init(query: String) {
        self.query = query
    }
}

public enum IntentDiscoverOutput: Codable {
    case ok(results: String)

    enum CodingKeys: String, CodingKey {
        case variant, results
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(results: try container.decode(String.self, forKey: .results))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let results):
            try container.encode("ok", forKey: .variant)
            try container.encode(results, forKey: .results)
        }
    }
}

public struct IntentDocumentInput: Codable {
    public let targetId: String

    public init(targetId: String) {
        self.targetId = targetId
    }
}

public enum IntentDocumentOutput: Codable {
    case ok(targetId: String, documentation: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, targetId, documentation, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                targetId: try container.decode(String.self, forKey: .targetId),
                documentation: try container.decode(String.self, forKey: .documentation)
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
        case .ok(let targetId, let documentation):
            try container.encode("ok", forKey: .variant)
            try container.encode(targetId, forKey: .targetId)
            try container.encode(documentation, forKey: .documentation)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol IntentHandler {
    func define(input: IntentDefineInput, storage: ConceptStorage) async throws -> IntentDefineOutput
    func update(input: IntentUpdateInput, storage: ConceptStorage) async throws -> IntentUpdateOutput
    func verify(input: IntentVerifyInput, storage: ConceptStorage) async throws -> IntentVerifyOutput
    func discover(input: IntentDiscoverInput, storage: ConceptStorage) async throws -> IntentDiscoverOutput
    func document(input: IntentDocumentInput, storage: ConceptStorage) async throws -> IntentDocumentOutput
}

// MARK: - Implementation

public struct IntentHandlerImpl: IntentHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func define(
        input: IntentDefineInput,
        storage: ConceptStorage
    ) async throws -> IntentDefineOutput {
        let now = iso8601Now()
        try await storage.put(
            relation: "intent",
            key: input.targetId,
            value: [
                "targetId": input.targetId,
                "purpose": input.purpose,
                "principles": input.principles,
                "description": input.description,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(targetId: input.targetId)
    }

    public func update(
        input: IntentUpdateInput,
        storage: ConceptStorage
    ) async throws -> IntentUpdateOutput {
        guard var existing = try await storage.get(relation: "intent", key: input.targetId) else {
            return .notfound(message: "Intent '\(input.targetId)' not found")
        }
        existing["changes"] = input.changes
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "intent", key: input.targetId, value: existing)
        return .ok(targetId: input.targetId)
    }

    public func verify(
        input: IntentVerifyInput,
        storage: ConceptStorage
    ) async throws -> IntentVerifyOutput {
        guard let existing = try await storage.get(relation: "intent", key: input.targetId) else {
            return .notfound(message: "Intent '\(input.targetId)' not found")
        }
        // Basic verification: check required fields are present
        let purpose = existing["purpose"] as? String ?? ""
        let principles = existing["principles"] as? String ?? ""
        var passed: [String] = []
        var failed: [String] = []
        if !purpose.isEmpty { passed.append("purpose_defined") } else { failed.append("purpose_missing") }
        if !principles.isEmpty { passed.append("principles_defined") } else { failed.append("principles_missing") }

        let passedStr: String
        if let encoded = try? JSONSerialization.data(withJSONObject: passed),
           let str = String(data: encoded, encoding: .utf8) {
            passedStr = str
        } else {
            passedStr = "[]"
        }
        let failedStr: String
        if let encoded = try? JSONSerialization.data(withJSONObject: failed),
           let str = String(data: encoded, encoding: .utf8) {
            failedStr = str
        } else {
            failedStr = "[]"
        }
        return .ok(targetId: input.targetId, passed: passedStr, failed: failedStr)
    }

    public func discover(
        input: IntentDiscoverInput,
        storage: ConceptStorage
    ) async throws -> IntentDiscoverOutput {
        let all = try await storage.find(relation: "intent", criteria: nil)
        let query = input.query.lowercased()
        let matched = all.filter { record in
            let purpose = (record["purpose"] as? String ?? "").lowercased()
            let description = (record["description"] as? String ?? "").lowercased()
            return purpose.contains(query) || description.contains(query)
        }
        let ids = matched.compactMap { $0["targetId"] as? String }
        if let encoded = try? JSONSerialization.data(withJSONObject: ids),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(results: str)
        }
        return .ok(results: "[]")
    }

    public func document(
        input: IntentDocumentInput,
        storage: ConceptStorage
    ) async throws -> IntentDocumentOutput {
        guard let existing = try await storage.get(relation: "intent", key: input.targetId) else {
            return .notfound(message: "Intent '\(input.targetId)' not found")
        }
        let purpose = existing["purpose"] as? String ?? ""
        let principles = existing["principles"] as? String ?? ""
        let description = existing["description"] as? String ?? ""
        let doc = "Purpose: \(purpose)\nPrinciples: \(principles)\nDescription: \(description)"
        return .ok(targetId: input.targetId, documentation: doc)
    }
}
