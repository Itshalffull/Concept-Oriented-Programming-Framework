// ProgressiveSchemaImpl.swift — ProgressiveSchema concept implementation

import Foundation

// MARK: - Types

public struct ProgressiveSchemaCaptureFreeformInput: Codable {
    public let content: String

    public init(content: String) {
        self.content = content
    }
}

public enum ProgressiveSchemaCaptureFreeformOutput: Codable {
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

public struct ProgressiveSchemaDetectStructureInput: Codable {
    public let itemId: String

    public init(itemId: String) {
        self.itemId = itemId
    }
}

public enum ProgressiveSchemaDetectStructureOutput: Codable {
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

public struct ProgressiveSchemaAcceptSuggestionInput: Codable {
    public let itemId: String
    public let suggestionId: String

    public init(itemId: String, suggestionId: String) {
        self.itemId = itemId
        self.suggestionId = suggestionId
    }
}

public enum ProgressiveSchemaAcceptSuggestionOutput: Codable {
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

public struct ProgressiveSchemaRejectSuggestionInput: Codable {
    public let itemId: String
    public let suggestionId: String

    public init(itemId: String, suggestionId: String) {
        self.itemId = itemId
        self.suggestionId = suggestionId
    }
}

public enum ProgressiveSchemaRejectSuggestionOutput: Codable {
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

public struct ProgressiveSchemaPromoteInput: Codable {
    public let itemId: String
    public let targetSchema: String

    public init(itemId: String, targetSchema: String) {
        self.itemId = itemId
        self.targetSchema = targetSchema
    }
}

public enum ProgressiveSchemaPromoteOutput: Codable {
    case ok(result: String)
    case notfound(message: String)
    case incomplete(gaps: String)

    enum CodingKeys: String, CodingKey {
        case variant, result, message, gaps
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(result: try container.decode(String.self, forKey: .result))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        case "incomplete":
            self = .incomplete(gaps: try container.decode(String.self, forKey: .gaps))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .incomplete(let gaps):
            try container.encode("incomplete", forKey: .variant)
            try container.encode(gaps, forKey: .gaps)
        }
    }
}

public struct ProgressiveSchemaInferSchemaInput: Codable {
    public let items: String

    public init(items: String) {
        self.items = items
    }
}

public enum ProgressiveSchemaInferSchemaOutput: Codable {
    case ok(proposedSchema: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, proposedSchema, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(proposedSchema: try container.decode(String.self, forKey: .proposedSchema))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let proposedSchema):
            try container.encode("ok", forKey: .variant)
            try container.encode(proposedSchema, forKey: .proposedSchema)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ProgressiveSchemaHandler {
    func captureFreeform(input: ProgressiveSchemaCaptureFreeformInput, storage: ConceptStorage) async throws -> ProgressiveSchemaCaptureFreeformOutput
    func detectStructure(input: ProgressiveSchemaDetectStructureInput, storage: ConceptStorage) async throws -> ProgressiveSchemaDetectStructureOutput
    func acceptSuggestion(input: ProgressiveSchemaAcceptSuggestionInput, storage: ConceptStorage) async throws -> ProgressiveSchemaAcceptSuggestionOutput
    func rejectSuggestion(input: ProgressiveSchemaRejectSuggestionInput, storage: ConceptStorage) async throws -> ProgressiveSchemaRejectSuggestionOutput
    func promote(input: ProgressiveSchemaPromoteInput, storage: ConceptStorage) async throws -> ProgressiveSchemaPromoteOutput
    func inferSchema(input: ProgressiveSchemaInferSchemaInput, storage: ConceptStorage) async throws -> ProgressiveSchemaInferSchemaOutput
}

// MARK: - Implementation

public struct ProgressiveSchemaHandlerImpl: ProgressiveSchemaHandler {
    public init() {}

    public func captureFreeform(
        input: ProgressiveSchemaCaptureFreeformInput,
        storage: ConceptStorage
    ) async throws -> ProgressiveSchemaCaptureFreeformOutput {
        let itemId = UUID().uuidString
        try await storage.put(
            relation: "progressive_items",
            key: itemId,
            value: [
                "itemId": itemId,
                "content": input.content,
                "structured": false,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(itemId: itemId)
    }

    public func detectStructure(
        input: ProgressiveSchemaDetectStructureInput,
        storage: ConceptStorage
    ) async throws -> ProgressiveSchemaDetectStructureOutput {
        guard let _ = try await storage.get(relation: "progressive_items", key: input.itemId) else {
            return .notfound(message: "Item '\(input.itemId)' not found")
        }
        return .ok(suggestions: "[]")
    }

    public func acceptSuggestion(
        input: ProgressiveSchemaAcceptSuggestionInput,
        storage: ConceptStorage
    ) async throws -> ProgressiveSchemaAcceptSuggestionOutput {
        guard let _ = try await storage.get(relation: "progressive_items", key: input.itemId) else {
            return .notfound(message: "Item '\(input.itemId)' not found")
        }
        let suggestionKey = "\(input.itemId):\(input.suggestionId)"
        try await storage.put(
            relation: "schema_suggestions",
            key: suggestionKey,
            value: [
                "itemId": input.itemId,
                "suggestionId": input.suggestionId,
                "status": "accepted",
            ]
        )
        return .ok
    }

    public func rejectSuggestion(
        input: ProgressiveSchemaRejectSuggestionInput,
        storage: ConceptStorage
    ) async throws -> ProgressiveSchemaRejectSuggestionOutput {
        guard let _ = try await storage.get(relation: "progressive_items", key: input.itemId) else {
            return .notfound(message: "Item '\(input.itemId)' not found")
        }
        let suggestionKey = "\(input.itemId):\(input.suggestionId)"
        try await storage.put(
            relation: "schema_suggestions",
            key: suggestionKey,
            value: [
                "itemId": input.itemId,
                "suggestionId": input.suggestionId,
                "status": "rejected",
            ]
        )
        return .ok
    }

    public func promote(
        input: ProgressiveSchemaPromoteInput,
        storage: ConceptStorage
    ) async throws -> ProgressiveSchemaPromoteOutput {
        guard let record = try await storage.get(relation: "progressive_items", key: input.itemId) else {
            return .notfound(message: "Item '\(input.itemId)' not found")
        }
        let content = record["content"] as? String ?? ""
        if content.isEmpty {
            return .incomplete(gaps: "[\"content is empty\"]")
        }
        var updated = record
        updated["structured"] = true
        updated["targetSchema"] = input.targetSchema
        try await storage.put(relation: "progressive_items", key: input.itemId, value: updated)
        return .ok(result: "{\"promoted\": true}")
    }

    public func inferSchema(
        input: ProgressiveSchemaInferSchemaInput,
        storage: ConceptStorage
    ) async throws -> ProgressiveSchemaInferSchemaOutput {
        if input.items.isEmpty {
            return .error(message: "No items provided for schema inference")
        }
        return .ok(proposedSchema: "{\"fields\": [], \"inferred\": true}")
    }
}
