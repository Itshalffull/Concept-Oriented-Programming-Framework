// ReferenceImpl.swift — Reference concept implementation

import Foundation

// MARK: - Types

public struct ReferenceAddRefInput: Codable {
    public let sourceId: String
    public let targetId: String
    public let refType: String

    public init(sourceId: String, targetId: String, refType: String) {
        self.sourceId = sourceId
        self.targetId = targetId
        self.refType = refType
    }
}

public enum ReferenceAddRefOutput: Codable {
    case ok(sourceId: String, targetId: String)

    enum CodingKeys: String, CodingKey {
        case variant, sourceId, targetId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sourceId: try container.decode(String.self, forKey: .sourceId),
                targetId: try container.decode(String.self, forKey: .targetId)
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
        case .ok(let sourceId, let targetId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sourceId, forKey: .sourceId)
            try container.encode(targetId, forKey: .targetId)
        }
    }
}

public struct ReferenceRemoveRefInput: Codable {
    public let sourceId: String
    public let targetId: String

    public init(sourceId: String, targetId: String) {
        self.sourceId = sourceId
        self.targetId = targetId
    }
}

public enum ReferenceRemoveRefOutput: Codable {
    case ok(sourceId: String, targetId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, sourceId, targetId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sourceId: try container.decode(String.self, forKey: .sourceId),
                targetId: try container.decode(String.self, forKey: .targetId)
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
        case .ok(let sourceId, let targetId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sourceId, forKey: .sourceId)
            try container.encode(targetId, forKey: .targetId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ReferenceGetRefsInput: Codable {
    public let sourceId: String

    public init(sourceId: String) {
        self.sourceId = sourceId
    }
}

public enum ReferenceGetRefsOutput: Codable {
    case ok(sourceId: String, refs: String)

    enum CodingKeys: String, CodingKey {
        case variant, sourceId, refs
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sourceId: try container.decode(String.self, forKey: .sourceId),
                refs: try container.decode(String.self, forKey: .refs)
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
        case .ok(let sourceId, let refs):
            try container.encode("ok", forKey: .variant)
            try container.encode(sourceId, forKey: .sourceId)
            try container.encode(refs, forKey: .refs)
        }
    }
}

// MARK: - Handler Protocol

public protocol ReferenceHandler {
    func addRef(input: ReferenceAddRefInput, storage: ConceptStorage) async throws -> ReferenceAddRefOutput
    func removeRef(input: ReferenceRemoveRefInput, storage: ConceptStorage) async throws -> ReferenceRemoveRefOutput
    func getRefs(input: ReferenceGetRefsInput, storage: ConceptStorage) async throws -> ReferenceGetRefsOutput
}

// MARK: - Implementation

public struct ReferenceHandlerImpl: ReferenceHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func addRef(
        input: ReferenceAddRefInput,
        storage: ConceptStorage
    ) async throws -> ReferenceAddRefOutput {
        let compKey = "\(input.sourceId)::\(input.targetId)"
        try await storage.put(
            relation: "reference",
            key: compKey,
            value: [
                "sourceId": input.sourceId,
                "targetId": input.targetId,
                "refType": input.refType,
                "createdAt": iso8601Now(),
            ]
        )
        return .ok(sourceId: input.sourceId, targetId: input.targetId)
    }

    public func removeRef(
        input: ReferenceRemoveRefInput,
        storage: ConceptStorage
    ) async throws -> ReferenceRemoveRefOutput {
        let compKey = "\(input.sourceId)::\(input.targetId)"
        guard try await storage.get(relation: "reference", key: compKey) != nil else {
            return .notfound(message: "Reference from '\(input.sourceId)' to '\(input.targetId)' not found")
        }
        try await storage.del(relation: "reference", key: compKey)
        return .ok(sourceId: input.sourceId, targetId: input.targetId)
    }

    public func getRefs(
        input: ReferenceGetRefsInput,
        storage: ConceptStorage
    ) async throws -> ReferenceGetRefsOutput {
        let results = try await storage.find(
            relation: "reference",
            criteria: ["sourceId": input.sourceId]
        )
        var refs: [[String: String]] = []
        for record in results {
            let targetId = record["targetId"] as? String ?? ""
            let refType = record["refType"] as? String ?? ""
            refs.append(["targetId": targetId, "refType": refType])
        }
        if let encoded = try? JSONSerialization.data(withJSONObject: refs),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(sourceId: input.sourceId, refs: str)
        }
        return .ok(sourceId: input.sourceId, refs: "[]")
    }
}
