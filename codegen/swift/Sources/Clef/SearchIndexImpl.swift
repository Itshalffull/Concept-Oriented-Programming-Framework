// SearchIndexImpl.swift — SearchIndex concept implementation

import Foundation

// MARK: - Types

public struct SearchIndexCreateIndexInput: Codable {
    public let indexId: String
    public let config: String

    public init(indexId: String, config: String) {
        self.indexId = indexId
        self.config = config
    }
}

public enum SearchIndexCreateIndexOutput: Codable {
    case ok(indexId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case indexId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(indexId: try container.decode(String.self, forKey: .indexId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let indexId):
            try container.encode("ok", forKey: .variant)
            try container.encode(indexId, forKey: .indexId)
        }
    }
}

public struct SearchIndexIndexItemInput: Codable {
    public let indexId: String
    public let nodeId: String
    public let content: String

    public init(indexId: String, nodeId: String, content: String) {
        self.indexId = indexId
        self.nodeId = nodeId
        self.content = content
    }
}

public enum SearchIndexIndexItemOutput: Codable {
    case ok(indexId: String, nodeId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case indexId
        case nodeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                indexId: try container.decode(String.self, forKey: .indexId),
                nodeId: try container.decode(String.self, forKey: .nodeId)
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
        case .ok(let indexId, let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(indexId, forKey: .indexId)
            try container.encode(nodeId, forKey: .nodeId)
        }
    }
}

public struct SearchIndexRemoveItemInput: Codable {
    public let indexId: String
    public let nodeId: String

    public init(indexId: String, nodeId: String) {
        self.indexId = indexId
        self.nodeId = nodeId
    }
}

public enum SearchIndexRemoveItemOutput: Codable {
    case ok(indexId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case indexId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(indexId: try container.decode(String.self, forKey: .indexId))
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
        case .ok(let indexId):
            try container.encode("ok", forKey: .variant)
            try container.encode(indexId, forKey: .indexId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SearchIndexSearchInput: Codable {
    public let indexId: String
    public let queryText: String

    public init(indexId: String, queryText: String) {
        self.indexId = indexId
        self.queryText = queryText
    }
}

public enum SearchIndexSearchOutput: Codable {
    case ok(indexId: String, results: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case indexId
        case results
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                indexId: try container.decode(String.self, forKey: .indexId),
                results: try container.decode(String.self, forKey: .results)
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
        case .ok(let indexId, let results):
            try container.encode("ok", forKey: .variant)
            try container.encode(indexId, forKey: .indexId)
            try container.encode(results, forKey: .results)
        }
    }
}

public struct SearchIndexReindexInput: Codable {
    public let indexId: String

    public init(indexId: String) {
        self.indexId = indexId
    }
}

public enum SearchIndexReindexOutput: Codable {
    case ok(indexId: String, count: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case indexId
        case count
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                indexId: try container.decode(String.self, forKey: .indexId),
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
        case .ok(let indexId, let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(indexId, forKey: .indexId)
            try container.encode(count, forKey: .count)
        }
    }
}

// MARK: - Handler Protocol

public protocol SearchIndexHandler {
    func createIndex(input: SearchIndexCreateIndexInput, storage: ConceptStorage) async throws -> SearchIndexCreateIndexOutput
    func indexItem(input: SearchIndexIndexItemInput, storage: ConceptStorage) async throws -> SearchIndexIndexItemOutput
    func removeItem(input: SearchIndexRemoveItemInput, storage: ConceptStorage) async throws -> SearchIndexRemoveItemOutput
    func search(input: SearchIndexSearchInput, storage: ConceptStorage) async throws -> SearchIndexSearchOutput
    func reindex(input: SearchIndexReindexInput, storage: ConceptStorage) async throws -> SearchIndexReindexOutput
}

// MARK: - Implementation

public struct SearchIndexHandlerImpl: SearchIndexHandler {
    public init() {}

    public func createIndex(
        input: SearchIndexCreateIndexInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexCreateIndexOutput {
        try await storage.put(
            relation: "search_index",
            key: input.indexId,
            value: [
                "id": input.indexId,
                "config": input.config,
            ]
        )
        return .ok(indexId: input.indexId)
    }

    public func indexItem(
        input: SearchIndexIndexItemInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexIndexItemOutput {
        let key = "\(input.indexId):\(input.nodeId)"
        try await storage.put(
            relation: "indexed_item",
            key: key,
            value: [
                "indexId": input.indexId,
                "nodeId": input.nodeId,
                "content": input.content,
            ]
        )
        return .ok(indexId: input.indexId, nodeId: input.nodeId)
    }

    public func removeItem(
        input: SearchIndexRemoveItemInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexRemoveItemOutput {
        let key = "\(input.indexId):\(input.nodeId)"
        guard try await storage.get(relation: "indexed_item", key: key) != nil else {
            return .notfound(message: "Item '\(input.nodeId)' not found in index '\(input.indexId)'")
        }
        try await storage.del(relation: "indexed_item", key: key)
        return .ok(indexId: input.indexId)
    }

    public func search(
        input: SearchIndexSearchInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexSearchOutput {
        let allItems = try await storage.find(
            relation: "indexed_item",
            criteria: ["indexId": input.indexId]
        )

        let queryLower = input.queryText.lowercased()
        let matched = allItems.filter { item in
            let content = (item["content"] as? String ?? "").lowercased()
            return content.contains(queryLower)
        }

        let resultIds = matched.compactMap { $0["nodeId"] as? String }
        let jsonData = try JSONSerialization.data(withJSONObject: resultIds, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(indexId: input.indexId, results: jsonString)
    }

    public func reindex(
        input: SearchIndexReindexInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexReindexOutput {
        let allItems = try await storage.find(
            relation: "indexed_item",
            criteria: ["indexId": input.indexId]
        )
        return .ok(indexId: input.indexId, count: allItems.count)
    }
}
