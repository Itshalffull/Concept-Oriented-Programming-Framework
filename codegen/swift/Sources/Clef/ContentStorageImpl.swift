// ContentStorageImpl.swift — ContentStorage concept implementation

import Foundation

// MARK: - Types

public struct ContentStorageSaveInput: Codable {
    public let nodeId: String
    public let data: String

    public init(nodeId: String, data: String) {
        self.nodeId = nodeId
        self.data = data
    }
}

public enum ContentStorageSaveOutput: Codable {
    case ok(nodeId: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        }
    }
}

public struct ContentStorageLoadInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum ContentStorageLoadOutput: Codable {
    case ok(nodeId: String, data: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, data, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                data: try container.decode(String.self, forKey: .data)
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
        case .ok(let nodeId, let data):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(data, forKey: .data)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ContentStorageDeleteInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum ContentStorageDeleteOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ContentStorageQueryInput: Codable {
    public let conditions: String

    public init(conditions: String) {
        self.conditions = conditions
    }
}

public enum ContentStorageQueryOutput: Codable {
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

// MARK: - Handler Protocol

public protocol ContentStorageHandler {
    func save(input: ContentStorageSaveInput, storage: ConceptStorage) async throws -> ContentStorageSaveOutput
    func load(input: ContentStorageLoadInput, storage: ConceptStorage) async throws -> ContentStorageLoadOutput
    func delete(input: ContentStorageDeleteInput, storage: ConceptStorage) async throws -> ContentStorageDeleteOutput
    func query(input: ContentStorageQueryInput, storage: ConceptStorage) async throws -> ContentStorageQueryOutput
}

// MARK: - Implementation

public struct ContentStorageHandlerImpl: ContentStorageHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func save(
        input: ContentStorageSaveInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageSaveOutput {
        let now = iso8601Now()
        try await storage.put(
            relation: "persisted_node",
            key: input.nodeId,
            value: [
                "nodeId": input.nodeId,
                "data": input.data,
                "savedAt": now,
            ]
        )
        return .ok(nodeId: input.nodeId)
    }

    public func load(
        input: ContentStorageLoadInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageLoadOutput {
        guard let record = try await storage.get(relation: "persisted_node", key: input.nodeId) else {
            return .notfound(message: "Persisted node '\(input.nodeId)' not found")
        }
        let data = record["data"] as? String ?? ""
        return .ok(nodeId: input.nodeId, data: data)
    }

    public func delete(
        input: ContentStorageDeleteInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageDeleteOutput {
        guard try await storage.get(relation: "persisted_node", key: input.nodeId) != nil else {
            return .notfound(message: "Persisted node '\(input.nodeId)' not found")
        }
        try await storage.del(relation: "persisted_node", key: input.nodeId)
        return .ok(nodeId: input.nodeId)
    }

    public func query(
        input: ContentStorageQueryInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageQueryOutput {
        // Parse conditions as JSON criteria
        var criteria: [String: Any]? = nil
        if let data = input.conditions.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            criteria = parsed
        }
        let results = try await storage.find(relation: "persisted_node", criteria: criteria)
        // Serialize results to JSON string
        let ids = results.compactMap { $0["nodeId"] as? String }
        if let encoded = try? JSONSerialization.data(withJSONObject: ids),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(results: str)
        }
        return .ok(results: "[]")
    }
}
