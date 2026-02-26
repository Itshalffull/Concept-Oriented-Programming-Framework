// EnricherImpl.swift — Enricher concept implementation

import Foundation

// MARK: - Types

public struct EnricherEnrichInput: Codable {
    public let itemId: String
    public let enricherId: String

    public init(itemId: String, enricherId: String) {
        self.itemId = itemId
        self.enricherId = enricherId
    }
}

public enum EnricherEnrichOutput: Codable {
    case ok(enrichmentId: String, result: String, confidence: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, enrichmentId, result, confidence, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                enrichmentId: try container.decode(String.self, forKey: .enrichmentId),
                result: try container.decode(String.self, forKey: .result),
                confidence: try container.decode(String.self, forKey: .confidence)
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
        case .ok(let enrichmentId, let result, let confidence):
            try container.encode("ok", forKey: .variant)
            try container.encode(enrichmentId, forKey: .enrichmentId)
            try container.encode(result, forKey: .result)
            try container.encode(confidence, forKey: .confidence)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct EnricherSuggestInput: Codable {
    public let itemId: String

    public init(itemId: String) {
        self.itemId = itemId
    }
}

public enum EnricherSuggestOutput: Codable {
    case ok(suggestions: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, suggestions, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(suggestions: try container.decode(String.self, forKey: .suggestions))
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
        case .ok(let suggestions):
            try container.encode("ok", forKey: .variant)
            try container.encode(suggestions, forKey: .suggestions)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct EnricherAcceptInput: Codable {
    public let itemId: String
    public let enrichmentId: String

    public init(itemId: String, enrichmentId: String) {
        self.itemId = itemId
        self.enrichmentId = enrichmentId
    }
}

public enum EnricherAcceptOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct EnricherRejectInput: Codable {
    public let itemId: String
    public let enrichmentId: String

    public init(itemId: String, enrichmentId: String) {
        self.itemId = itemId
        self.enrichmentId = enrichmentId
    }
}

public enum EnricherRejectOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct EnricherRefreshStaleInput: Codable {
    public let olderThan: String

    public init(olderThan: String) {
        self.olderThan = olderThan
    }
}

public enum EnricherRefreshStaleOutput: Codable {
    case ok(refreshed: Int)

    enum CodingKeys: String, CodingKey {
        case variant, refreshed
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(refreshed: try container.decode(Int.self, forKey: .refreshed))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let refreshed):
            try container.encode("ok", forKey: .variant)
            try container.encode(refreshed, forKey: .refreshed)
        }
    }
}

// MARK: - Handler Protocol

public protocol EnricherHandler {
    func enrich(input: EnricherEnrichInput, storage: ConceptStorage) async throws -> EnricherEnrichOutput
    func suggest(input: EnricherSuggestInput, storage: ConceptStorage) async throws -> EnricherSuggestOutput
    func accept(input: EnricherAcceptInput, storage: ConceptStorage) async throws -> EnricherAcceptOutput
    func reject(input: EnricherRejectInput, storage: ConceptStorage) async throws -> EnricherRejectOutput
    func refreshStale(input: EnricherRefreshStaleInput, storage: ConceptStorage) async throws -> EnricherRefreshStaleOutput
}

// MARK: - Implementation

public struct EnricherHandlerImpl: EnricherHandler {
    public init() {}

    public func enrich(
        input: EnricherEnrichInput,
        storage: ConceptStorage
    ) async throws -> EnricherEnrichOutput {
        guard let _ = try await storage.get(relation: "enricher_items", key: input.itemId) else {
            return .notfound(message: "Item '\(input.itemId)' not found")
        }
        let enrichmentId = UUID().uuidString
        try await storage.put(
            relation: "enrichments",
            key: enrichmentId,
            value: [
                "enrichmentId": enrichmentId,
                "itemId": input.itemId,
                "enricherId": input.enricherId,
                "status": "pending",
                "result": "{}",
                "confidence": "0.0",
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(enrichmentId: enrichmentId, result: "{}", confidence: "0.0")
    }

    public func suggest(
        input: EnricherSuggestInput,
        storage: ConceptStorage
    ) async throws -> EnricherSuggestOutput {
        guard let _ = try await storage.get(relation: "enricher_items", key: input.itemId) else {
            return .notfound(message: "Item '\(input.itemId)' not found")
        }
        return .ok(suggestions: "[]")
    }

    public func accept(
        input: EnricherAcceptInput,
        storage: ConceptStorage
    ) async throws -> EnricherAcceptOutput {
        guard var record = try await storage.get(relation: "enrichments", key: input.enrichmentId) else {
            return .notfound(message: "Enrichment '\(input.enrichmentId)' not found")
        }
        record["status"] = "accepted"
        try await storage.put(relation: "enrichments", key: input.enrichmentId, value: record)
        return .ok
    }

    public func reject(
        input: EnricherRejectInput,
        storage: ConceptStorage
    ) async throws -> EnricherRejectOutput {
        guard var record = try await storage.get(relation: "enrichments", key: input.enrichmentId) else {
            return .notfound(message: "Enrichment '\(input.enrichmentId)' not found")
        }
        record["status"] = "rejected"
        try await storage.put(relation: "enrichments", key: input.enrichmentId, value: record)
        return .ok
    }

    public func refreshStale(
        input: EnricherRefreshStaleInput,
        storage: ConceptStorage
    ) async throws -> EnricherRefreshStaleOutput {
        let allEnrichments = try await storage.find(relation: "enrichments", criteria: nil)
        var refreshed = 0
        for entry in allEnrichments {
            let createdAt = entry["createdAt"] as? String ?? ""
            if createdAt < input.olderThan {
                refreshed += 1
            }
        }
        return .ok(refreshed: refreshed)
    }
}
