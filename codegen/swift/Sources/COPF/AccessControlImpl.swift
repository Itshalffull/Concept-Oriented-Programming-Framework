// AccessControlImpl.swift — AccessControl concept implementation

import Foundation

// MARK: - Types

public struct AccessControlCheckInput: Codable {
    public let entityId: String
    public let operation: String
    public let userId: String

    public init(entityId: String, operation: String, userId: String) {
        self.entityId = entityId
        self.operation = operation
        self.userId = userId
    }
}

public enum AccessControlCheckOutput: Codable {
    case ok(result: String, cacheTags: String)

    enum CodingKeys: String, CodingKey {
        case variant, result, cacheTags
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                result: try container.decode(String.self, forKey: .result),
                cacheTags: try container.decode(String.self, forKey: .cacheTags)
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
        case .ok(let result, let cacheTags):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
            try container.encode(cacheTags, forKey: .cacheTags)
        }
    }
}

public struct AccessControlOrIfInput: Codable {
    public let resultA: String
    public let resultB: String

    public init(resultA: String, resultB: String) {
        self.resultA = resultA
        self.resultB = resultB
    }
}

public enum AccessControlOrIfOutput: Codable {
    case ok(result: String)

    enum CodingKeys: String, CodingKey {
        case variant, result
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(result: try container.decode(String.self, forKey: .result))
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
        }
    }
}

public struct AccessControlAndIfInput: Codable {
    public let resultA: String
    public let resultB: String

    public init(resultA: String, resultB: String) {
        self.resultA = resultA
        self.resultB = resultB
    }
}

public enum AccessControlAndIfOutput: Codable {
    case ok(result: String)

    enum CodingKeys: String, CodingKey {
        case variant, result
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(result: try container.decode(String.self, forKey: .result))
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
        }
    }
}

// MARK: - Handler Protocol

public protocol AccessControlHandler {
    func check(input: AccessControlCheckInput, storage: ConceptStorage) async throws -> AccessControlCheckOutput
    func orIf(input: AccessControlOrIfInput, storage: ConceptStorage) async throws -> AccessControlOrIfOutput
    func andIf(input: AccessControlAndIfInput, storage: ConceptStorage) async throws -> AccessControlAndIfOutput
}

// MARK: - Implementation

public struct AccessControlHandlerImpl: AccessControlHandler {
    public init() {}

    public func check(
        input: AccessControlCheckInput,
        storage: ConceptStorage
    ) async throws -> AccessControlCheckOutput {
        // Purely computational: default to "neutral" unless specific rules apply
        let cacheTags = ["entity:\(input.entityId)", "user:\(input.userId)", "op:\(input.operation)"]
        if let encoded = try? JSONSerialization.data(withJSONObject: cacheTags),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(result: "neutral", cacheTags: str)
        }
        return .ok(result: "neutral", cacheTags: "[]")
    }

    public func orIf(
        input: AccessControlOrIfInput,
        storage: ConceptStorage
    ) async throws -> AccessControlOrIfOutput {
        // OR logic: "allowed" wins, then "neutral", then "forbidden"
        if input.resultA == "allowed" || input.resultB == "allowed" {
            return .ok(result: "allowed")
        }
        if input.resultA == "neutral" || input.resultB == "neutral" {
            return .ok(result: "neutral")
        }
        return .ok(result: "forbidden")
    }

    public func andIf(
        input: AccessControlAndIfInput,
        storage: ConceptStorage
    ) async throws -> AccessControlAndIfOutput {
        // AND logic: "forbidden" wins, then "neutral", then "allowed"
        if input.resultA == "forbidden" || input.resultB == "forbidden" {
            return .ok(result: "forbidden")
        }
        if input.resultA == "neutral" || input.resultB == "neutral" {
            return .ok(result: "neutral")
        }
        return .ok(result: "allowed")
    }
}
