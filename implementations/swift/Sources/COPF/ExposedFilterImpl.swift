// ExposedFilterImpl.swift — ExposedFilter concept implementation

import Foundation

// MARK: - Types

public struct ExposedFilterExposeInput: Codable {
    public let filterId: String
    public let config: String

    public init(filterId: String, config: String) {
        self.filterId = filterId
        self.config = config
    }
}

public enum ExposedFilterExposeOutput: Codable {
    case ok(filterId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case filterId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(filterId: try container.decode(String.self, forKey: .filterId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let filterId):
            try container.encode("ok", forKey: .variant)
            try container.encode(filterId, forKey: .filterId)
        }
    }
}

public struct ExposedFilterCollectInputInput: Codable {
    public let filterId: String
    public let userValue: String

    public init(filterId: String, userValue: String) {
        self.filterId = filterId
        self.userValue = userValue
    }
}

public enum ExposedFilterCollectInputOutput: Codable {
    case ok(filterId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case filterId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(filterId: try container.decode(String.self, forKey: .filterId))
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
        case .ok(let filterId):
            try container.encode("ok", forKey: .variant)
            try container.encode(filterId, forKey: .filterId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ExposedFilterApplyToQueryInput: Codable {
    public let queryId: String

    public init(queryId: String) {
        self.queryId = queryId
    }
}

public enum ExposedFilterApplyToQueryOutput: Codable {
    case ok(queryId: String, appliedFilters: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case queryId
        case appliedFilters
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                queryId: try container.decode(String.self, forKey: .queryId),
                appliedFilters: try container.decode(String.self, forKey: .appliedFilters)
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
        case .ok(let queryId, let appliedFilters):
            try container.encode("ok", forKey: .variant)
            try container.encode(queryId, forKey: .queryId)
            try container.encode(appliedFilters, forKey: .appliedFilters)
        }
    }
}

public struct ExposedFilterResetToDefaultsInput: Codable {
    public init() {}
}

public enum ExposedFilterResetToDefaultsOutput: Codable {
    case ok(count: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case count
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(count: try container.decode(Int.self, forKey: .count))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(count, forKey: .count)
        }
    }
}

// MARK: - Handler Protocol

public protocol ExposedFilterHandler {
    func expose(input: ExposedFilterExposeInput, storage: ConceptStorage) async throws -> ExposedFilterExposeOutput
    func collectInput(input: ExposedFilterCollectInputInput, storage: ConceptStorage) async throws -> ExposedFilterCollectInputOutput
    func applyToQuery(input: ExposedFilterApplyToQueryInput, storage: ConceptStorage) async throws -> ExposedFilterApplyToQueryOutput
    func resetToDefaults(input: ExposedFilterResetToDefaultsInput, storage: ConceptStorage) async throws -> ExposedFilterResetToDefaultsOutput
}

// MARK: - Implementation

public struct ExposedFilterHandlerImpl: ExposedFilterHandler {
    public init() {}

    public func expose(
        input: ExposedFilterExposeInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterExposeOutput {
        try await storage.put(
            relation: "exposed_filter",
            key: input.filterId,
            value: [
                "id": input.filterId,
                "config": input.config,
                "userValue": "",
            ]
        )
        return .ok(filterId: input.filterId)
    }

    public func collectInput(
        input: ExposedFilterCollectInputInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterCollectInputOutput {
        guard let existing = try await storage.get(relation: "exposed_filter", key: input.filterId) else {
            return .notfound(message: "Exposed filter '\(input.filterId)' not found")
        }

        var updated = existing
        updated["userValue"] = input.userValue
        try await storage.put(relation: "exposed_filter", key: input.filterId, value: updated)

        return .ok(filterId: input.filterId)
    }

    public func applyToQuery(
        input: ExposedFilterApplyToQueryInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterApplyToQueryOutput {
        let allFilters = try await storage.find(relation: "exposed_filter", criteria: nil)

        let applied = allFilters.compactMap { filter -> [String: String]? in
            let userValue = filter["userValue"] as? String ?? ""
            guard !userValue.isEmpty else { return nil }
            return [
                "filterId": filter["id"] as? String ?? "",
                "userValue": userValue,
            ]
        }

        let jsonData = try JSONSerialization.data(withJSONObject: applied, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(queryId: input.queryId, appliedFilters: jsonString)
    }

    public func resetToDefaults(
        input: ExposedFilterResetToDefaultsInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterResetToDefaultsOutput {
        let allFilters = try await storage.find(relation: "exposed_filter", criteria: nil)
        var count = 0

        for filter in allFilters {
            let filterId = filter["id"] as? String ?? ""
            var updated = filter
            updated["userValue"] = ""
            try await storage.put(relation: "exposed_filter", key: filterId, value: updated)
            count += 1
        }

        return .ok(count: count)
    }
}
