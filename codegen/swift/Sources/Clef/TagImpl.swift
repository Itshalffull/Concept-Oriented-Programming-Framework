// TagImpl.swift — Tag concept implementation

import Foundation

// MARK: - Types (matching generated Tag/Types.swift)

public struct TagAddTagInput: Codable {
    public let entity: String
    public let tag: String

    public init(entity: String, tag: String) {
        self.entity = entity
        self.tag = tag
    }
}

public enum TagAddTagOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TagRemoveTagInput: Codable {
    public let entity: String
    public let tag: String

    public init(entity: String, tag: String) {
        self.entity = entity
        self.tag = tag
    }
}

public enum TagRemoveTagOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TagGetByTagInput: Codable {
    public let tag: String

    public init(tag: String) {
        self.tag = tag
    }
}

public enum TagGetByTagOutput: Codable {
    case ok(entities: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entities
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entities: try container.decode(String.self, forKey: .entities)
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
        case .ok(let entities):
            try container.encode("ok", forKey: .variant)
            try container.encode(entities, forKey: .entities)
        }
    }
}

public struct TagGetChildrenInput: Codable {
    public let tag: String

    public init(tag: String) {
        self.tag = tag
    }
}

public enum TagGetChildrenOutput: Codable {
    case ok(children: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case children
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                children: try container.decode(String.self, forKey: .children)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let children):
            try container.encode("ok", forKey: .variant)
            try container.encode(children, forKey: .children)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TagRenameInput: Codable {
    public let tag: String
    public let name: String

    public init(tag: String, name: String) {
        self.tag = tag
        self.name = name
    }
}

public enum TagRenameOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol (matching generated Tag/Handler.swift)

public protocol TagHandler {
    func addTag(
        input: TagAddTagInput,
        storage: ConceptStorage
    ) async throws -> TagAddTagOutput

    func removeTag(
        input: TagRemoveTagInput,
        storage: ConceptStorage
    ) async throws -> TagRemoveTagOutput

    func getByTag(
        input: TagGetByTagInput,
        storage: ConceptStorage
    ) async throws -> TagGetByTagOutput

    func getChildren(
        input: TagGetChildrenInput,
        storage: ConceptStorage
    ) async throws -> TagGetChildrenOutput

    func rename(
        input: TagRenameInput,
        storage: ConceptStorage
    ) async throws -> TagRenameOutput
}

// MARK: - Implementation

public struct TagHandlerImpl: TagHandler {
    public init() {}

    public func addTag(
        input: TagAddTagInput,
        storage: ConceptStorage
    ) async throws -> TagAddTagOutput {
        let existing = try await storage.get(relation: "tag", key: input.tag)
        var entities: [String]
        if let existingRecord = existing,
           let jsonString = existingRecord["tagIndex"] as? String,
           let data = jsonString.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            entities = parsed
        } else {
            entities = []
        }

        if !entities.contains(input.entity) {
            entities.append(input.entity)
        }

        let jsonData = try JSONSerialization.data(withJSONObject: entities, options: [])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        try await storage.put(
            relation: "tag",
            key: input.tag,
            value: [
                "tag": input.tag,
                "name": (existing?["name"] as? String) ?? input.tag,
                "tagIndex": jsonString,
            ]
        )

        return .ok
    }

    public func removeTag(
        input: TagRemoveTagInput,
        storage: ConceptStorage
    ) async throws -> TagRemoveTagOutput {
        guard let existing = try await storage.get(relation: "tag", key: input.tag) else {
            return .notfound(message: "Tag does not exist")
        }

        var entities: [String] = []
        if let jsonString = existing["tagIndex"] as? String,
           let data = jsonString.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            entities = parsed
        }

        entities = entities.filter { $0 != input.entity }

        let jsonData = try JSONSerialization.data(withJSONObject: entities, options: [])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        try await storage.put(
            relation: "tag",
            key: input.tag,
            value: [
                "tag": input.tag,
                "name": (existing["name"] as? String) ?? input.tag,
                "tagIndex": jsonString,
            ]
        )

        return .ok
    }

    public func getByTag(
        input: TagGetByTagInput,
        storage: ConceptStorage
    ) async throws -> TagGetByTagOutput {
        let existing = try await storage.get(relation: "tag", key: input.tag)

        var entities: [String] = []
        if let record = existing,
           let jsonString = record["tagIndex"] as? String,
           let data = jsonString.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            entities = parsed
        }

        let result = entities.count == 1 ? entities[0] : entities.joined(separator: ",")
        return .ok(entities: result)
    }

    public func getChildren(
        input: TagGetChildrenInput,
        storage: ConceptStorage
    ) async throws -> TagGetChildrenOutput {
        guard try await storage.get(relation: "tag", key: input.tag) != nil else {
            return .notfound(message: "Tag does not exist")
        }

        let allTags = try await storage.find(relation: "tag", criteria: nil)
        let children = allTags
            .filter { ($0["parent"] as? String) == input.tag }
            .compactMap { $0["tag"] as? String }

        let jsonData = try JSONSerialization.data(withJSONObject: children, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(children: jsonString)
    }

    public func rename(
        input: TagRenameInput,
        storage: ConceptStorage
    ) async throws -> TagRenameOutput {
        guard var existing = try await storage.get(relation: "tag", key: input.tag) else {
            return .notfound(message: "Tag does not exist")
        }

        existing["name"] = input.name

        try await storage.put(
            relation: "tag",
            key: input.tag,
            value: existing
        )

        return .ok
    }
}
