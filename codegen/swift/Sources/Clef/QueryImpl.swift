// QueryImpl.swift — Query concept implementation

import Foundation

// MARK: - Types

public struct QueryCreateInput: Codable {
    public let queryString: String
    public let scope: String

    public init(queryString: String, scope: String) {
        self.queryString = queryString
        self.scope = scope
    }
}

public enum QueryCreateOutput: Codable {
    case ok(queryId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case queryId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(queryId: try container.decode(String.self, forKey: .queryId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let queryId):
            try container.encode("ok", forKey: .variant)
            try container.encode(queryId, forKey: .queryId)
        }
    }
}

public struct QueryExecuteInput: Codable {
    public let queryId: String

    public init(queryId: String) {
        self.queryId = queryId
    }
}

public enum QueryExecuteOutput: Codable {
    case ok(queryId: String, results: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case queryId
        case results
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                queryId: try container.decode(String.self, forKey: .queryId),
                results: try container.decode(String.self, forKey: .results)
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
        case .ok(let queryId, let results):
            try container.encode("ok", forKey: .variant)
            try container.encode(queryId, forKey: .queryId)
            try container.encode(results, forKey: .results)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct QueryAddFilterInput: Codable {
    public let queryId: String
    public let field: String
    public let `operator`: String
    public let value: String

    public init(queryId: String, field: String, operator: String, value: String) {
        self.queryId = queryId
        self.field = field
        self.operator = `operator`
        self.value = value
    }
}

public enum QueryAddFilterOutput: Codable {
    case ok(queryId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case queryId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(queryId: try container.decode(String.self, forKey: .queryId))
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
        case .ok(let queryId):
            try container.encode("ok", forKey: .variant)
            try container.encode(queryId, forKey: .queryId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct QueryAddSortInput: Codable {
    public let queryId: String
    public let field: String
    public let direction: String

    public init(queryId: String, field: String, direction: String) {
        self.queryId = queryId
        self.field = field
        self.direction = direction
    }
}

public enum QueryAddSortOutput: Codable {
    case ok(queryId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case queryId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(queryId: try container.decode(String.self, forKey: .queryId))
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
        case .ok(let queryId):
            try container.encode("ok", forKey: .variant)
            try container.encode(queryId, forKey: .queryId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol QueryHandler {
    func create(input: QueryCreateInput, storage: ConceptStorage) async throws -> QueryCreateOutput
    func execute(input: QueryExecuteInput, storage: ConceptStorage) async throws -> QueryExecuteOutput
    func addFilter(input: QueryAddFilterInput, storage: ConceptStorage) async throws -> QueryAddFilterOutput
    func addSort(input: QueryAddSortInput, storage: ConceptStorage) async throws -> QueryAddSortOutput
}

// MARK: - Implementation

public struct QueryHandlerImpl: QueryHandler {
    public init() {}

    public func create(
        input: QueryCreateInput,
        storage: ConceptStorage
    ) async throws -> QueryCreateOutput {
        let queryId = UUID().uuidString
        try await storage.put(
            relation: "query_def",
            key: queryId,
            value: [
                "id": queryId,
                "queryString": input.queryString,
                "scope": input.scope,
                "filters": "[]",
                "sorts": "[]",
            ]
        )
        return .ok(queryId: queryId)
    }

    public func execute(
        input: QueryExecuteInput,
        storage: ConceptStorage
    ) async throws -> QueryExecuteOutput {
        guard let query = try await storage.get(relation: "query_def", key: input.queryId) else {
            return .notfound(message: "Query '\(input.queryId)' not found")
        }

        let queryString = query["queryString"] as? String ?? ""
        let filters = query["filters"] as? String ?? "[]"
        let sorts = query["sorts"] as? String ?? "[]"

        let resultInfo: [String: String] = [
            "queryString": queryString,
            "filters": filters,
            "sorts": sorts,
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: resultInfo, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"

        return .ok(queryId: input.queryId, results: jsonString)
    }

    public func addFilter(
        input: QueryAddFilterInput,
        storage: ConceptStorage
    ) async throws -> QueryAddFilterOutput {
        guard let existing = try await storage.get(relation: "query_def", key: input.queryId) else {
            return .notfound(message: "Query '\(input.queryId)' not found")
        }

        let filtersJson = existing["filters"] as? String ?? "[]"
        var filters: [[String: String]] = []
        if let data = filtersJson.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
            filters = parsed
        }

        filters.append([
            "field": input.field,
            "operator": input.operator,
            "value": input.value,
        ])

        let jsonData = try JSONSerialization.data(withJSONObject: filters, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        var updated = existing
        updated["filters"] = jsonString
        try await storage.put(relation: "query_def", key: input.queryId, value: updated)

        return .ok(queryId: input.queryId)
    }

    public func addSort(
        input: QueryAddSortInput,
        storage: ConceptStorage
    ) async throws -> QueryAddSortOutput {
        guard let existing = try await storage.get(relation: "query_def", key: input.queryId) else {
            return .notfound(message: "Query '\(input.queryId)' not found")
        }

        let sortsJson = existing["sorts"] as? String ?? "[]"
        var sorts: [[String: String]] = []
        if let data = sortsJson.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
            sorts = parsed
        }

        sorts.append([
            "field": input.field,
            "direction": input.direction,
        ])

        let jsonData = try JSONSerialization.data(withJSONObject: sorts, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        var updated = existing
        updated["sorts"] = jsonString
        try await storage.put(relation: "query_def", key: input.queryId, value: updated)

        return .ok(queryId: input.queryId)
    }
}
