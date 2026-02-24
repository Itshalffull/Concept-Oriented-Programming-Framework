// FieldMappingImpl.swift — FieldMapping concept implementation

import Foundation

// MARK: - Types

public struct FieldMappingMapInput: Codable {
    public let mappingId: String
    public let sourceField: String
    public let destField: String
    public let transform: String

    public init(mappingId: String, sourceField: String, destField: String, transform: String) {
        self.mappingId = mappingId
        self.sourceField = sourceField
        self.destField = destField
        self.transform = transform
    }
}

public enum FieldMappingMapOutput: Codable {
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

public struct FieldMappingApplyInput: Codable {
    public let record: String
    public let mappingId: String

    public init(record: String, mappingId: String) {
        self.record = record
        self.mappingId = mappingId
    }
}

public enum FieldMappingApplyOutput: Codable {
    case ok(mapped: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, mapped, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(mapped: try container.decode(String.self, forKey: .mapped))
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
        case .ok(let mapped):
            try container.encode("ok", forKey: .variant)
            try container.encode(mapped, forKey: .mapped)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FieldMappingReverseInput: Codable {
    public let record: String
    public let mappingId: String

    public init(record: String, mappingId: String) {
        self.record = record
        self.mappingId = mappingId
    }
}

public enum FieldMappingReverseOutput: Codable {
    case ok(reversed: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, reversed, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(reversed: try container.decode(String.self, forKey: .reversed))
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
        case .ok(let reversed):
            try container.encode("ok", forKey: .variant)
            try container.encode(reversed, forKey: .reversed)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FieldMappingAutoDiscoverInput: Codable {
    public let sourceSchema: String
    public let destSchema: String

    public init(sourceSchema: String, destSchema: String) {
        self.sourceSchema = sourceSchema
        self.destSchema = destSchema
    }
}

public enum FieldMappingAutoDiscoverOutput: Codable {
    case ok(mappingId: String, suggestions: String)

    enum CodingKeys: String, CodingKey {
        case variant, mappingId, suggestions
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                mappingId: try container.decode(String.self, forKey: .mappingId),
                suggestions: try container.decode(String.self, forKey: .suggestions)
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
        case .ok(let mappingId, let suggestions):
            try container.encode("ok", forKey: .variant)
            try container.encode(mappingId, forKey: .mappingId)
            try container.encode(suggestions, forKey: .suggestions)
        }
    }
}

public struct FieldMappingValidateInput: Codable {
    public let mappingId: String

    public init(mappingId: String) {
        self.mappingId = mappingId
    }
}

public enum FieldMappingValidateOutput: Codable {
    case ok(warnings: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, warnings, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(warnings: try container.decode(String.self, forKey: .warnings))
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
        case .ok(let warnings):
            try container.encode("ok", forKey: .variant)
            try container.encode(warnings, forKey: .warnings)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol FieldMappingHandler {
    func map(input: FieldMappingMapInput, storage: ConceptStorage) async throws -> FieldMappingMapOutput
    func apply(input: FieldMappingApplyInput, storage: ConceptStorage) async throws -> FieldMappingApplyOutput
    func reverse(input: FieldMappingReverseInput, storage: ConceptStorage) async throws -> FieldMappingReverseOutput
    func autoDiscover(input: FieldMappingAutoDiscoverInput, storage: ConceptStorage) async throws -> FieldMappingAutoDiscoverOutput
    func validate(input: FieldMappingValidateInput, storage: ConceptStorage) async throws -> FieldMappingValidateOutput
}

// MARK: - Implementation

public struct FieldMappingHandlerImpl: FieldMappingHandler {
    public init() {}

    public func map(
        input: FieldMappingMapInput,
        storage: ConceptStorage
    ) async throws -> FieldMappingMapOutput {
        let entryKey = "\(input.mappingId):\(input.sourceField)"
        try await storage.put(
            relation: "field_mappings",
            key: entryKey,
            value: [
                "mappingId": input.mappingId,
                "sourceField": input.sourceField,
                "destField": input.destField,
                "transform": input.transform,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok
    }

    public func apply(
        input: FieldMappingApplyInput,
        storage: ConceptStorage
    ) async throws -> FieldMappingApplyOutput {
        let entries = try await storage.find(relation: "field_mappings", criteria: ["mappingId": input.mappingId])
        if entries.isEmpty {
            return .notfound(message: "Mapping '\(input.mappingId)' not found")
        }
        return .ok(mapped: input.record)
    }

    public func reverse(
        input: FieldMappingReverseInput,
        storage: ConceptStorage
    ) async throws -> FieldMappingReverseOutput {
        let entries = try await storage.find(relation: "field_mappings", criteria: ["mappingId": input.mappingId])
        if entries.isEmpty {
            return .notfound(message: "Mapping '\(input.mappingId)' not found")
        }
        return .ok(reversed: input.record)
    }

    public func autoDiscover(
        input: FieldMappingAutoDiscoverInput,
        storage: ConceptStorage
    ) async throws -> FieldMappingAutoDiscoverOutput {
        let mappingId = UUID().uuidString
        try await storage.put(
            relation: "field_mapping_sets",
            key: mappingId,
            value: [
                "mappingId": mappingId,
                "sourceSchema": input.sourceSchema,
                "destSchema": input.destSchema,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(mappingId: mappingId, suggestions: "[]")
    }

    public func validate(
        input: FieldMappingValidateInput,
        storage: ConceptStorage
    ) async throws -> FieldMappingValidateOutput {
        let entries = try await storage.find(relation: "field_mappings", criteria: ["mappingId": input.mappingId])
        if entries.isEmpty {
            return .notfound(message: "Mapping '\(input.mappingId)' not found")
        }
        return .ok(warnings: "[]")
    }
}
