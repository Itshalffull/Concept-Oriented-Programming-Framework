// CacheImpl.swift — Cache concept implementation

import Foundation

// MARK: - Types

public struct CacheSetInput: Codable {
    public let key: String
    public let value: String
    public let tags: String
    public let maxAge: Int

    public init(key: String, value: String, tags: String, maxAge: Int) {
        self.key = key
        self.value = value
        self.tags = tags
        self.maxAge = maxAge
    }
}

public enum CacheSetOutput: Codable {
    case ok(key: String)

    enum CodingKeys: String, CodingKey {
        case variant, key
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(key: try container.decode(String.self, forKey: .key))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let key):
            try container.encode("ok", forKey: .variant)
            try container.encode(key, forKey: .key)
        }
    }
}

public struct CacheGetInput: Codable {
    public let key: String

    public init(key: String) {
        self.key = key
    }
}

public enum CacheGetOutput: Codable {
    case ok(key: String, value: String)
    case miss(key: String)

    enum CodingKeys: String, CodingKey {
        case variant, key, value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                key: try container.decode(String.self, forKey: .key),
                value: try container.decode(String.self, forKey: .value)
            )
        case "miss":
            self = .miss(key: try container.decode(String.self, forKey: .key))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let key, let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(key, forKey: .key)
            try container.encode(value, forKey: .value)
        case .miss(let key):
            try container.encode("miss", forKey: .variant)
            try container.encode(key, forKey: .key)
        }
    }
}

public struct CacheInvalidateInput: Codable {
    public let key: String

    public init(key: String) {
        self.key = key
    }
}

public enum CacheInvalidateOutput: Codable {
    case ok(key: String)

    enum CodingKeys: String, CodingKey {
        case variant, key
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(key: try container.decode(String.self, forKey: .key))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let key):
            try container.encode("ok", forKey: .variant)
            try container.encode(key, forKey: .key)
        }
    }
}

public struct CacheInvalidateByTagsInput: Codable {
    public let tags: String

    public init(tags: String) {
        self.tags = tags
    }
}

public enum CacheInvalidateByTagsOutput: Codable {
    case ok(count: Int)

    enum CodingKeys: String, CodingKey {
        case variant, count
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

public protocol CacheHandler {
    func set(input: CacheSetInput, storage: ConceptStorage) async throws -> CacheSetOutput
    func get(input: CacheGetInput, storage: ConceptStorage) async throws -> CacheGetOutput
    func invalidate(input: CacheInvalidateInput, storage: ConceptStorage) async throws -> CacheInvalidateOutput
    func invalidateByTags(input: CacheInvalidateByTagsInput, storage: ConceptStorage) async throws -> CacheInvalidateByTagsOutput
}

// MARK: - Implementation

public struct CacheHandlerImpl: CacheHandler {
    public init() {}

    public func set(
        input: CacheSetInput,
        storage: ConceptStorage
    ) async throws -> CacheSetOutput {
        try await storage.put(
            relation: "cache_bin",
            key: input.key,
            value: [
                "key": input.key,
                "value": input.value,
                "tags": input.tags,
                "maxAge": input.maxAge,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(key: input.key)
    }

    public func get(
        input: CacheGetInput,
        storage: ConceptStorage
    ) async throws -> CacheGetOutput {
        guard let record = try await storage.get(relation: "cache_bin", key: input.key) else {
            return .miss(key: input.key)
        }
        let value = record["value"] as? String ?? ""
        return .ok(key: input.key, value: value)
    }

    public func invalidate(
        input: CacheInvalidateInput,
        storage: ConceptStorage
    ) async throws -> CacheInvalidateOutput {
        try await storage.del(relation: "cache_bin", key: input.key)
        return .ok(key: input.key)
    }

    public func invalidateByTags(
        input: CacheInvalidateByTagsInput,
        storage: ConceptStorage
    ) async throws -> CacheInvalidateByTagsOutput {
        let allEntries = try await storage.find(relation: "cache_bin", criteria: nil)
        let targetTags = Set(input.tags.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) })
        var count = 0
        for entry in allEntries {
            let entryTags = (entry["tags"] as? String ?? "")
                .split(separator: ",")
                .map { String($0).trimmingCharacters(in: .whitespaces) }
            let entryTagSet = Set(entryTags)
            if !targetTags.intersection(entryTagSet).isEmpty {
                let key = entry["key"] as? String ?? ""
                try await storage.del(relation: "cache_bin", key: key)
                count += 1
            }
        }
        return .ok(count: count)
    }
}
