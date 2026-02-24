// SyncPairImpl.swift — SyncPair concept implementation

import Foundation

// MARK: - Types

public struct SyncPairLinkInput: Codable {
    public let pairId: String
    public let idA: String
    public let idB: String

    public init(pairId: String, idA: String, idB: String) {
        self.pairId = pairId
        self.idA = idA
        self.idB = idB
    }
}

public enum SyncPairLinkOutput: Codable {
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

public struct SyncPairSyncInput: Codable {
    public let pairId: String

    public init(pairId: String) {
        self.pairId = pairId
    }
}

public enum SyncPairSyncOutput: Codable {
    case ok(changes: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, changes, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(changes: try container.decode(String.self, forKey: .changes))
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
        case .ok(let changes):
            try container.encode("ok", forKey: .variant)
            try container.encode(changes, forKey: .changes)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncPairDetectConflictsInput: Codable {
    public let pairId: String

    public init(pairId: String) {
        self.pairId = pairId
    }
}

public enum SyncPairDetectConflictsOutput: Codable {
    case ok(conflicts: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, conflicts, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(conflicts: try container.decode(String.self, forKey: .conflicts))
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
        case .ok(let conflicts):
            try container.encode("ok", forKey: .variant)
            try container.encode(conflicts, forKey: .conflicts)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncPairResolveInput: Codable {
    public let conflictId: String
    public let resolution: String

    public init(conflictId: String, resolution: String) {
        self.conflictId = conflictId
        self.resolution = resolution
    }
}

public enum SyncPairResolveOutput: Codable {
    case ok(winner: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, winner, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(winner: try container.decode(String.self, forKey: .winner))
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
        case .ok(let winner):
            try container.encode("ok", forKey: .variant)
            try container.encode(winner, forKey: .winner)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncPairUnlinkInput: Codable {
    public let pairId: String
    public let idA: String

    public init(pairId: String, idA: String) {
        self.pairId = pairId
        self.idA = idA
    }
}

public enum SyncPairUnlinkOutput: Codable {
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

public struct SyncPairGetChangeLogInput: Codable {
    public let pairId: String
    public let since: String

    public init(pairId: String, since: String) {
        self.pairId = pairId
        self.since = since
    }
}

public enum SyncPairGetChangeLogOutput: Codable {
    case ok(log: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, log, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(log: try container.decode(String.self, forKey: .log))
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
        case .ok(let log):
            try container.encode("ok", forKey: .variant)
            try container.encode(log, forKey: .log)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol SyncPairHandler {
    func link(input: SyncPairLinkInput, storage: ConceptStorage) async throws -> SyncPairLinkOutput
    func sync(input: SyncPairSyncInput, storage: ConceptStorage) async throws -> SyncPairSyncOutput
    func detectConflicts(input: SyncPairDetectConflictsInput, storage: ConceptStorage) async throws -> SyncPairDetectConflictsOutput
    func resolve(input: SyncPairResolveInput, storage: ConceptStorage) async throws -> SyncPairResolveOutput
    func unlink(input: SyncPairUnlinkInput, storage: ConceptStorage) async throws -> SyncPairUnlinkOutput
    func getChangeLog(input: SyncPairGetChangeLogInput, storage: ConceptStorage) async throws -> SyncPairGetChangeLogOutput
}

// MARK: - Implementation

public struct SyncPairHandlerImpl: SyncPairHandler {
    public init() {}

    public func link(
        input: SyncPairLinkInput,
        storage: ConceptStorage
    ) async throws -> SyncPairLinkOutput {
        let linkKey = "\(input.pairId):\(input.idA):\(input.idB)"
        try await storage.put(
            relation: "sync_pairs",
            key: linkKey,
            value: [
                "pairId": input.pairId,
                "idA": input.idA,
                "idB": input.idB,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok
    }

    public func sync(
        input: SyncPairSyncInput,
        storage: ConceptStorage
    ) async throws -> SyncPairSyncOutput {
        let entries = try await storage.find(relation: "sync_pairs", criteria: ["pairId": input.pairId])
        if entries.isEmpty {
            return .notfound(message: "Sync pair '\(input.pairId)' not found")
        }
        return .ok(changes: "[]")
    }

    public func detectConflicts(
        input: SyncPairDetectConflictsInput,
        storage: ConceptStorage
    ) async throws -> SyncPairDetectConflictsOutput {
        let entries = try await storage.find(relation: "sync_pairs", criteria: ["pairId": input.pairId])
        if entries.isEmpty {
            return .notfound(message: "Sync pair '\(input.pairId)' not found")
        }
        return .ok(conflicts: "[]")
    }

    public func resolve(
        input: SyncPairResolveInput,
        storage: ConceptStorage
    ) async throws -> SyncPairResolveOutput {
        guard var record = try await storage.get(relation: "sync_conflicts", key: input.conflictId) else {
            return .notfound(message: "Conflict '\(input.conflictId)' not found")
        }
        record["resolution"] = input.resolution
        record["resolvedAt"] = ISO8601DateFormatter().string(from: Date())
        try await storage.put(relation: "sync_conflicts", key: input.conflictId, value: record)
        return .ok(winner: input.resolution)
    }

    public func unlink(
        input: SyncPairUnlinkInput,
        storage: ConceptStorage
    ) async throws -> SyncPairUnlinkOutput {
        let entries = try await storage.find(relation: "sync_pairs", criteria: ["pairId": input.pairId])
        if entries.isEmpty {
            return .notfound(message: "Sync pair '\(input.pairId)' not found")
        }
        for entry in entries {
            let idA = entry["idA"] as? String ?? ""
            if idA == input.idA {
                let idB = entry["idB"] as? String ?? ""
                let linkKey = "\(input.pairId):\(idA):\(idB)"
                try await storage.del(relation: "sync_pairs", key: linkKey)
            }
        }
        return .ok
    }

    public func getChangeLog(
        input: SyncPairGetChangeLogInput,
        storage: ConceptStorage
    ) async throws -> SyncPairGetChangeLogOutput {
        let entries = try await storage.find(relation: "sync_pairs", criteria: ["pairId": input.pairId])
        if entries.isEmpty {
            return .notfound(message: "Sync pair '\(input.pairId)' not found")
        }
        return .ok(log: "[]")
    }
}
