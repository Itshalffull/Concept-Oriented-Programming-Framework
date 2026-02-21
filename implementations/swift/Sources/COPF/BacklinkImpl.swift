// BacklinkImpl.swift — Backlink concept implementation

import Foundation

// MARK: - Types

public struct BacklinkGetBacklinksInput: Codable {
    public let entityId: String

    public init(entityId: String) {
        self.entityId = entityId
    }
}

public enum BacklinkGetBacklinksOutput: Codable {
    case ok(entityId: String, backlinks: String)

    enum CodingKeys: String, CodingKey {
        case variant, entityId, backlinks
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                backlinks: try container.decode(String.self, forKey: .backlinks)
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
        case .ok(let entityId, let backlinks):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(backlinks, forKey: .backlinks)
        }
    }
}

public struct BacklinkReindexInput: Codable {
    public init() {}
}

public enum BacklinkReindexOutput: Codable {
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

public protocol BacklinkHandler {
    func getBacklinks(input: BacklinkGetBacklinksInput, storage: ConceptStorage) async throws -> BacklinkGetBacklinksOutput
    func reindex(input: BacklinkReindexInput, storage: ConceptStorage) async throws -> BacklinkReindexOutput
}

// MARK: - Implementation

public struct BacklinkHandlerImpl: BacklinkHandler {
    public init() {}

    public func getBacklinks(
        input: BacklinkGetBacklinksInput,
        storage: ConceptStorage
    ) async throws -> BacklinkGetBacklinksOutput {
        let results = try await storage.find(
            relation: "backlink",
            criteria: ["targetId": input.entityId]
        )
        let sourceIds = results.compactMap { $0["sourceId"] as? String }
        if let encoded = try? JSONSerialization.data(withJSONObject: sourceIds),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(entityId: input.entityId, backlinks: str)
        }
        return .ok(entityId: input.entityId, backlinks: "[]")
    }

    public func reindex(
        input: BacklinkReindexInput,
        storage: ConceptStorage
    ) async throws -> BacklinkReindexOutput {
        // Rebuild backlinks from the reference relation
        let allRefs = try await storage.find(relation: "reference", criteria: nil)
        var count = 0
        for ref in allRefs {
            let sourceId = ref["sourceId"] as? String ?? ""
            let targetId = ref["targetId"] as? String ?? ""
            if !sourceId.isEmpty && !targetId.isEmpty {
                let compKey = "\(targetId)::\(sourceId)"
                try await storage.put(
                    relation: "backlink",
                    key: compKey,
                    value: [
                        "targetId": targetId,
                        "sourceId": sourceId,
                    ]
                )
                count += 1
            }
        }
        return .ok(count: count)
    }
}
