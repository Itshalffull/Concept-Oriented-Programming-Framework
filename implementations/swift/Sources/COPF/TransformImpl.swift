// TransformImpl.swift — Transform concept implementation

import Foundation

// MARK: - Types

public struct TransformApplyInput: Codable {
    public let value: String
    public let transformId: String

    public init(value: String, transformId: String) {
        self.value = value
        self.transformId = transformId
    }
}

public enum TransformApplyOutput: Codable {
    case ok(result: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, result, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(result: try container.decode(String.self, forKey: .result))
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
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct TransformChainInput: Codable {
    public let value: String
    public let transformIds: String

    public init(value: String, transformIds: String) {
        self.value = value
        self.transformIds = transformIds
    }
}

public enum TransformChainOutput: Codable {
    case ok(result: String)
    case error(message: String, failedAt: String)

    enum CodingKeys: String, CodingKey {
        case variant, result, message, failedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(result: try container.decode(String.self, forKey: .result))
        case "error":
            self = .error(
                message: try container.decode(String.self, forKey: .message),
                failedAt: try container.decode(String.self, forKey: .failedAt)
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
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        case .error(let message, let failedAt):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
            try container.encode(failedAt, forKey: .failedAt)
        }
    }
}

public struct TransformPreviewInput: Codable {
    public let value: String
    public let transformId: String

    public init(value: String, transformId: String) {
        self.value = value
        self.transformId = transformId
    }
}

public enum TransformPreviewOutput: Codable {
    case ok(before: String, after: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, before, after, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                before: try container.decode(String.self, forKey: .before),
                after: try container.decode(String.self, forKey: .after)
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
        case .ok(let before, let after):
            try container.encode("ok", forKey: .variant)
            try container.encode(before, forKey: .before)
            try container.encode(after, forKey: .after)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol TransformHandler {
    func apply(input: TransformApplyInput, storage: ConceptStorage) async throws -> TransformApplyOutput
    func chain(input: TransformChainInput, storage: ConceptStorage) async throws -> TransformChainOutput
    func preview(input: TransformPreviewInput, storage: ConceptStorage) async throws -> TransformPreviewOutput
}

// MARK: - Implementation

public struct TransformHandlerImpl: TransformHandler {
    public init() {}

    public func apply(
        input: TransformApplyInput,
        storage: ConceptStorage
    ) async throws -> TransformApplyOutput {
        guard let _ = try await storage.get(relation: "transforms", key: input.transformId) else {
            return .notfound(message: "Transform '\(input.transformId)' not found")
        }
        return .ok(result: input.value)
    }

    public func chain(
        input: TransformChainInput,
        storage: ConceptStorage
    ) async throws -> TransformChainOutput {
        let ids = input.transformIds.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
        var current = input.value
        for id in ids {
            guard let _ = try await storage.get(relation: "transforms", key: id) else {
                return .error(message: "Transform '\(id)' not found", failedAt: id)
            }
            current = current
        }
        return .ok(result: current)
    }

    public func preview(
        input: TransformPreviewInput,
        storage: ConceptStorage
    ) async throws -> TransformPreviewOutput {
        guard let _ = try await storage.get(relation: "transforms", key: input.transformId) else {
            return .notfound(message: "Transform '\(input.transformId)' not found")
        }
        return .ok(before: input.value, after: input.value)
    }
}
