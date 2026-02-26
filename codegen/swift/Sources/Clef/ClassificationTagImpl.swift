// ClassificationTagImpl.swift — ClassificationTag concept implementation

import Foundation

// MARK: - Types

public struct ClassificationTagAddTagInput: Codable {
    public let nodeId: String
    public let tagName: String

    public init(nodeId: String, tagName: String) {
        self.nodeId = nodeId
        self.tagName = tagName
    }
}

public enum ClassificationTagAddTagOutput: Codable {
    case ok(tagName: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tagName
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tagName: try container.decode(String.self, forKey: .tagName)
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
        case .ok(let tagName):
            try container.encode("ok", forKey: .variant)
            try container.encode(tagName, forKey: .tagName)
        }
    }
}

public struct ClassificationTagRemoveTagInput: Codable {
    public let nodeId: String
    public let tagName: String

    public init(nodeId: String, tagName: String) {
        self.nodeId = nodeId
        self.tagName = tagName
    }
}

public enum ClassificationTagRemoveTagOutput: Codable {
    case ok(tagName: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tagName
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tagName: try container.decode(String.self, forKey: .tagName)
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
        case .ok(let tagName):
            try container.encode("ok", forKey: .variant)
            try container.encode(tagName, forKey: .tagName)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ClassificationTagGetByTagInput: Codable {
    public let tagName: String

    public init(tagName: String) {
        self.tagName = tagName
    }
}

public enum ClassificationTagGetByTagOutput: Codable {
    case ok(tagName: String, nodeIds: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tagName
        case nodeIds
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tagName: try container.decode(String.self, forKey: .tagName),
                nodeIds: try container.decode(String.self, forKey: .nodeIds)
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
        case .ok(let tagName, let nodeIds):
            try container.encode("ok", forKey: .variant)
            try container.encode(tagName, forKey: .tagName)
            try container.encode(nodeIds, forKey: .nodeIds)
        }
    }
}

public struct ClassificationTagRenameInput: Codable {
    public let oldTag: String
    public let newTag: String

    public init(oldTag: String, newTag: String) {
        self.oldTag = oldTag
        self.newTag = newTag
    }
}

public enum ClassificationTagRenameOutput: Codable {
    case ok(tagName: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tagName
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tagName: try container.decode(String.self, forKey: .tagName)
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
        case .ok(let tagName):
            try container.encode("ok", forKey: .variant)
            try container.encode(tagName, forKey: .tagName)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ClassificationTagHandler {
    func addTag(input: ClassificationTagAddTagInput, storage: ConceptStorage) async throws -> ClassificationTagAddTagOutput
    func removeTag(input: ClassificationTagRemoveTagInput, storage: ConceptStorage) async throws -> ClassificationTagRemoveTagOutput
    func getByTag(input: ClassificationTagGetByTagInput, storage: ConceptStorage) async throws -> ClassificationTagGetByTagOutput
    func rename(input: ClassificationTagRenameInput, storage: ConceptStorage) async throws -> ClassificationTagRenameOutput
}

// MARK: - Implementation

public struct ClassificationTagHandlerImpl: ClassificationTagHandler {
    public init() {}

    public func addTag(
        input: ClassificationTagAddTagInput,
        storage: ConceptStorage
    ) async throws -> ClassificationTagAddTagOutput {
        let entryKey = "\(input.nodeId):\(input.tagName)"
        try await storage.put(
            relation: "tag_entry",
            key: entryKey,
            value: [
                "nodeId": input.nodeId,
                "tagName": input.tagName,
            ]
        )

        // Update tag index
        let existing = try await storage.get(relation: "tag_index", key: input.tagName)
        var nodeIds: [String]
        if let record = existing, let ids = record["nodeIds"] as? [String] {
            nodeIds = ids
        } else {
            nodeIds = []
        }
        if !nodeIds.contains(input.nodeId) {
            nodeIds.append(input.nodeId)
        }
        try await storage.put(
            relation: "tag_index",
            key: input.tagName,
            value: [
                "tagName": input.tagName,
                "nodeIds": nodeIds,
            ]
        )

        return .ok(tagName: input.tagName)
    }

    public func removeTag(
        input: ClassificationTagRemoveTagInput,
        storage: ConceptStorage
    ) async throws -> ClassificationTagRemoveTagOutput {
        let entryKey = "\(input.nodeId):\(input.tagName)"
        guard try await storage.get(relation: "tag_entry", key: entryKey) != nil else {
            return .notfound(message: "Tag entry '\(input.tagName)' for node '\(input.nodeId)' not found")
        }

        try await storage.del(relation: "tag_entry", key: entryKey)

        // Update tag index
        let existing = try await storage.get(relation: "tag_index", key: input.tagName)
        if let record = existing, let ids = record["nodeIds"] as? [String] {
            let updated = ids.filter { $0 != input.nodeId }
            try await storage.put(
                relation: "tag_index",
                key: input.tagName,
                value: [
                    "tagName": input.tagName,
                    "nodeIds": updated,
                ]
            )
        }

        return .ok(tagName: input.tagName)
    }

    public func getByTag(
        input: ClassificationTagGetByTagInput,
        storage: ConceptStorage
    ) async throws -> ClassificationTagGetByTagOutput {
        let existing = try await storage.get(relation: "tag_index", key: input.tagName)
        var nodeIds: [String] = []
        if let record = existing, let ids = record["nodeIds"] as? [String] {
            nodeIds = ids
        }

        let jsonData = try JSONSerialization.data(withJSONObject: nodeIds, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(tagName: input.tagName, nodeIds: jsonString)
    }

    public func rename(
        input: ClassificationTagRenameInput,
        storage: ConceptStorage
    ) async throws -> ClassificationTagRenameOutput {
        guard let existing = try await storage.get(relation: "tag_index", key: input.oldTag) else {
            return .notfound(message: "Tag '\(input.oldTag)' not found")
        }

        let nodeIds = existing["nodeIds"] as? [String] ?? []

        // Remove old index
        try await storage.del(relation: "tag_index", key: input.oldTag)

        // Create new index
        try await storage.put(
            relation: "tag_index",
            key: input.newTag,
            value: [
                "tagName": input.newTag,
                "nodeIds": nodeIds,
            ]
        )

        // Update tag_entry records
        for nodeId in nodeIds {
            let oldKey = "\(nodeId):\(input.oldTag)"
            let newKey = "\(nodeId):\(input.newTag)"
            try await storage.del(relation: "tag_entry", key: oldKey)
            try await storage.put(
                relation: "tag_entry",
                key: newKey,
                value: [
                    "nodeId": nodeId,
                    "tagName": input.newTag,
                ]
            )
        }

        return .ok(tagName: input.newTag)
    }
}
