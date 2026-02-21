// TaxonomyImpl.swift — Taxonomy concept implementation

import Foundation

// MARK: - Types

public struct TaxonomyCreateVocabularyInput: Codable {
    public let name: String

    public init(name: String) {
        self.name = name
    }
}

public enum TaxonomyCreateVocabularyOutput: Codable {
    case ok(vocabId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case vocabId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(vocabId: try container.decode(String.self, forKey: .vocabId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let vocabId):
            try container.encode("ok", forKey: .variant)
            try container.encode(vocabId, forKey: .vocabId)
        }
    }
}

public struct TaxonomyAddTermInput: Codable {
    public let vocabId: String
    public let name: String
    public let parentTermId: String

    public init(vocabId: String, name: String, parentTermId: String) {
        self.vocabId = vocabId
        self.name = name
        self.parentTermId = parentTermId
    }
}

public enum TaxonomyAddTermOutput: Codable {
    case ok(termId: String)
    case vocabNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case termId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(termId: try container.decode(String.self, forKey: .termId))
        case "vocabNotfound":
            self = .vocabNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let termId):
            try container.encode("ok", forKey: .variant)
            try container.encode(termId, forKey: .termId)
        case .vocabNotfound(let message):
            try container.encode("vocabNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TaxonomySetParentInput: Codable {
    public let termId: String
    public let parentTermId: String

    public init(termId: String, parentTermId: String) {
        self.termId = termId
        self.parentTermId = parentTermId
    }
}

public enum TaxonomySetParentOutput: Codable {
    case ok(termId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case termId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(termId: try container.decode(String.self, forKey: .termId))
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
        case .ok(let termId):
            try container.encode("ok", forKey: .variant)
            try container.encode(termId, forKey: .termId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TaxonomyTagEntityInput: Codable {
    public let nodeId: String
    public let termId: String

    public init(nodeId: String, termId: String) {
        self.nodeId = nodeId
        self.termId = termId
    }
}

public enum TaxonomyTagEntityOutput: Codable {
    case ok(nodeId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
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

public struct TaxonomyUntagEntityInput: Codable {
    public let nodeId: String
    public let termId: String

    public init(nodeId: String, termId: String) {
        self.nodeId = nodeId
        self.termId = termId
    }
}

public enum TaxonomyUntagEntityOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
        case message
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

// MARK: - Handler Protocol

public protocol TaxonomyHandler {
    func createVocabulary(input: TaxonomyCreateVocabularyInput, storage: ConceptStorage) async throws -> TaxonomyCreateVocabularyOutput
    func addTerm(input: TaxonomyAddTermInput, storage: ConceptStorage) async throws -> TaxonomyAddTermOutput
    func setParent(input: TaxonomySetParentInput, storage: ConceptStorage) async throws -> TaxonomySetParentOutput
    func tagEntity(input: TaxonomyTagEntityInput, storage: ConceptStorage) async throws -> TaxonomyTagEntityOutput
    func untagEntity(input: TaxonomyUntagEntityInput, storage: ConceptStorage) async throws -> TaxonomyUntagEntityOutput
}

// MARK: - Implementation

public struct TaxonomyHandlerImpl: TaxonomyHandler {
    public init() {}

    public func createVocabulary(
        input: TaxonomyCreateVocabularyInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyCreateVocabularyOutput {
        let vocabId = UUID().uuidString
        try await storage.put(
            relation: "vocabulary",
            key: vocabId,
            value: [
                "id": vocabId,
                "name": input.name,
            ]
        )
        return .ok(vocabId: vocabId)
    }

    public func addTerm(
        input: TaxonomyAddTermInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyAddTermOutput {
        guard try await storage.get(relation: "vocabulary", key: input.vocabId) != nil else {
            return .vocabNotfound(message: "Vocabulary '\(input.vocabId)' not found")
        }

        let termId = UUID().uuidString
        try await storage.put(
            relation: "term",
            key: termId,
            value: [
                "id": termId,
                "vocabId": input.vocabId,
                "name": input.name,
                "parentTermId": input.parentTermId,
            ]
        )

        // Update term index
        let indexKey = "\(input.vocabId):\(termId)"
        try await storage.put(
            relation: "term_index",
            key: indexKey,
            value: [
                "vocabId": input.vocabId,
                "termId": termId,
                "name": input.name,
            ]
        )

        return .ok(termId: termId)
    }

    public func setParent(
        input: TaxonomySetParentInput,
        storage: ConceptStorage
    ) async throws -> TaxonomySetParentOutput {
        guard let existing = try await storage.get(relation: "term", key: input.termId) else {
            return .notfound(message: "Term '\(input.termId)' not found")
        }

        var updated = existing
        updated["parentTermId"] = input.parentTermId
        try await storage.put(relation: "term", key: input.termId, value: updated)

        return .ok(termId: input.termId)
    }

    public func tagEntity(
        input: TaxonomyTagEntityInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyTagEntityOutput {
        let key = "\(input.nodeId):\(input.termId)"
        try await storage.put(
            relation: "term_index",
            key: key,
            value: [
                "nodeId": input.nodeId,
                "termId": input.termId,
            ]
        )
        return .ok(nodeId: input.nodeId)
    }

    public func untagEntity(
        input: TaxonomyUntagEntityInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyUntagEntityOutput {
        let key = "\(input.nodeId):\(input.termId)"
        guard try await storage.get(relation: "term_index", key: key) != nil else {
            return .notfound(message: "Entity tagging for node '\(input.nodeId)' with term '\(input.termId)' not found")
        }
        try await storage.del(relation: "term_index", key: key)
        return .ok(nodeId: input.nodeId)
    }
}
