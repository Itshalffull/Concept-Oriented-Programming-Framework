// ContentNodeImpl.swift — ContentNode concept implementation

import Foundation

// MARK: - Types

public struct ContentNodeCreateInput: Codable {
    public let id: String
    public let nodeType: String
    public let content: String

    public init(id: String, nodeType: String, content: String) {
        self.id = id
        self.nodeType = nodeType
        self.content = content
    }
}

public enum ContentNodeCreateOutput: Codable {
    case ok(id: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, id, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(id: try container.decode(String.self, forKey: .id))
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
        case .ok(let id):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ContentNodeUpdateInput: Codable {
    public let id: String
    public let content: String

    public init(id: String, content: String) {
        self.id = id
        self.content = content
    }
}

public enum ContentNodeUpdateOutput: Codable {
    case ok(id: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, id, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(id: try container.decode(String.self, forKey: .id))
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
        case .ok(let id):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ContentNodeDeleteInput: Codable {
    public let id: String

    public init(id: String) {
        self.id = id
    }
}

public enum ContentNodeDeleteOutput: Codable {
    case ok(id: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, id, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(id: try container.decode(String.self, forKey: .id))
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
        case .ok(let id):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ContentNodeSetMetadataInput: Codable {
    public let id: String
    public let key: String
    public let value: String

    public init(id: String, key: String, value: String) {
        self.id = id
        self.key = key
        self.value = value
    }
}

public enum ContentNodeSetMetadataOutput: Codable {
    case ok(id: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, id, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(id: try container.decode(String.self, forKey: .id))
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
        case .ok(let id):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ContentNodeGetMetadataInput: Codable {
    public let id: String
    public let key: String

    public init(id: String, key: String) {
        self.id = id
        self.key = key
    }
}

public enum ContentNodeGetMetadataOutput: Codable {
    case ok(id: String, key: String, value: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, id, key, value, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                id: try container.decode(String.self, forKey: .id),
                key: try container.decode(String.self, forKey: .key),
                value: try container.decode(String.self, forKey: .value)
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
        case .ok(let id, let key, let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
            try container.encode(key, forKey: .key)
            try container.encode(value, forKey: .value)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ContentNodeChangeTypeInput: Codable {
    public let id: String
    public let newType: String

    public init(id: String, newType: String) {
        self.id = id
        self.newType = newType
    }
}

public enum ContentNodeChangeTypeOutput: Codable {
    case ok(id: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, id, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(id: try container.decode(String.self, forKey: .id))
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
        case .ok(let id):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ContentNodeHandler {
    func create(input: ContentNodeCreateInput, storage: ConceptStorage) async throws -> ContentNodeCreateOutput
    func update(input: ContentNodeUpdateInput, storage: ConceptStorage) async throws -> ContentNodeUpdateOutput
    func delete(input: ContentNodeDeleteInput, storage: ConceptStorage) async throws -> ContentNodeDeleteOutput
    func setMetadata(input: ContentNodeSetMetadataInput, storage: ConceptStorage) async throws -> ContentNodeSetMetadataOutput
    func getMetadata(input: ContentNodeGetMetadataInput, storage: ConceptStorage) async throws -> ContentNodeGetMetadataOutput
    func changeType(input: ContentNodeChangeTypeInput, storage: ConceptStorage) async throws -> ContentNodeChangeTypeOutput
}

// MARK: - Implementation

public struct ContentNodeHandlerImpl: ContentNodeHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func create(
        input: ContentNodeCreateInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeCreateOutput {
        let now = iso8601Now()
        try await storage.put(
            relation: "content_node",
            key: input.id,
            value: [
                "id": input.id,
                "nodeType": input.nodeType,
                "content": input.content,
                "metadata": "{}",
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(id: input.id)
    }

    public func update(
        input: ContentNodeUpdateInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeUpdateOutput {
        guard var existing = try await storage.get(relation: "content_node", key: input.id) else {
            return .notfound(message: "ContentNode '\(input.id)' not found")
        }
        existing["content"] = input.content
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "content_node", key: input.id, value: existing)
        return .ok(id: input.id)
    }

    public func delete(
        input: ContentNodeDeleteInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeDeleteOutput {
        guard try await storage.get(relation: "content_node", key: input.id) != nil else {
            return .notfound(message: "ContentNode '\(input.id)' not found")
        }
        try await storage.del(relation: "content_node", key: input.id)
        return .ok(id: input.id)
    }

    public func setMetadata(
        input: ContentNodeSetMetadataInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeSetMetadataOutput {
        guard var existing = try await storage.get(relation: "content_node", key: input.id) else {
            return .notfound(message: "ContentNode '\(input.id)' not found")
        }
        var meta = existing["metadata"] as? String ?? "{}"
        // Simple key-value store in metadata string as JSON
        var metaDict: [String: String] = [:]
        if let data = meta.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            metaDict = parsed
        }
        metaDict[input.key] = input.value
        if let encoded = try? JSONSerialization.data(withJSONObject: metaDict),
           let str = String(data: encoded, encoding: .utf8) {
            meta = str
        }
        existing["metadata"] = meta
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "content_node", key: input.id, value: existing)
        return .ok(id: input.id)
    }

    public func getMetadata(
        input: ContentNodeGetMetadataInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeGetMetadataOutput {
        guard let existing = try await storage.get(relation: "content_node", key: input.id) else {
            return .notfound(message: "ContentNode '\(input.id)' not found")
        }
        let meta = existing["metadata"] as? String ?? "{}"
        if let data = meta.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: String],
           let value = parsed[input.key] {
            return .ok(id: input.id, key: input.key, value: value)
        }
        return .notfound(message: "Metadata key '\(input.key)' not found on node '\(input.id)'")
    }

    public func changeType(
        input: ContentNodeChangeTypeInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeChangeTypeOutput {
        guard var existing = try await storage.get(relation: "content_node", key: input.id) else {
            return .notfound(message: "ContentNode '\(input.id)' not found")
        }
        existing["nodeType"] = input.newType
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "content_node", key: input.id, value: existing)
        return .ok(id: input.id)
    }
}
