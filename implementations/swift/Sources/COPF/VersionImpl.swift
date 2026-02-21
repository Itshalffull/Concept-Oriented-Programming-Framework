// VersionImpl.swift — Version concept implementation

import Foundation

// MARK: - Types

public struct VersionSnapshotInput: Codable {
    public let entityId: String
    public let snapshotData: String

    public init(entityId: String, snapshotData: String) {
        self.entityId = entityId
        self.snapshotData = snapshotData
    }
}

public enum VersionSnapshotOutput: Codable {
    case ok(entityId: String, versionId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entityId
        case versionId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                versionId: try container.decode(String.self, forKey: .versionId)
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
        case .ok(let entityId, let versionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(versionId, forKey: .versionId)
        }
    }
}

public struct VersionListVersionsInput: Codable {
    public let entityId: String

    public init(entityId: String) {
        self.entityId = entityId
    }
}

public enum VersionListVersionsOutput: Codable {
    case ok(entityId: String, versions: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entityId
        case versions
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                versions: try container.decode(String.self, forKey: .versions)
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
        case .ok(let entityId, let versions):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(versions, forKey: .versions)
        }
    }
}

public struct VersionRollbackInput: Codable {
    public let entityId: String
    public let versionId: String

    public init(entityId: String, versionId: String) {
        self.entityId = entityId
        self.versionId = versionId
    }
}

public enum VersionRollbackOutput: Codable {
    case ok(entityId: String)
    case versionNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entityId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(entityId: try container.decode(String.self, forKey: .entityId))
        case "versionNotfound":
            self = .versionNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let entityId):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
        case .versionNotfound(let message):
            try container.encode("versionNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct VersionDiffInput: Codable {
    public let entityId: String
    public let versionA: String
    public let versionB: String

    public init(entityId: String, versionA: String, versionB: String) {
        self.entityId = entityId
        self.versionA = versionA
        self.versionB = versionB
    }
}

public enum VersionDiffOutput: Codable {
    case ok(entityId: String, changes: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entityId
        case changes
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                changes: try container.decode(String.self, forKey: .changes)
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
        case .ok(let entityId, let changes):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(changes, forKey: .changes)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol VersionHandler {
    func snapshot(input: VersionSnapshotInput, storage: ConceptStorage) async throws -> VersionSnapshotOutput
    func listVersions(input: VersionListVersionsInput, storage: ConceptStorage) async throws -> VersionListVersionsOutput
    func rollback(input: VersionRollbackInput, storage: ConceptStorage) async throws -> VersionRollbackOutput
    func diff(input: VersionDiffInput, storage: ConceptStorage) async throws -> VersionDiffOutput
}

// MARK: - Implementation

public struct VersionHandlerImpl: VersionHandler {
    public init() {}

    public func snapshot(
        input: VersionSnapshotInput,
        storage: ConceptStorage
    ) async throws -> VersionSnapshotOutput {
        let versionId = UUID().uuidString
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let now = formatter.string(from: Date())

        let key = "\(input.entityId):\(versionId)"
        try await storage.put(
            relation: "version_history",
            key: key,
            value: [
                "entityId": input.entityId,
                "versionId": versionId,
                "snapshotData": input.snapshotData,
                "createdAt": now,
            ]
        )

        return .ok(entityId: input.entityId, versionId: versionId)
    }

    public func listVersions(
        input: VersionListVersionsInput,
        storage: ConceptStorage
    ) async throws -> VersionListVersionsOutput {
        let allVersions = try await storage.find(
            relation: "version_history",
            criteria: ["entityId": input.entityId]
        )

        let sorted = allVersions.sorted { a, b in
            let dateA = a["createdAt"] as? String ?? ""
            let dateB = b["createdAt"] as? String ?? ""
            return dateA < dateB
        }

        let versionDicts: [[String: String]] = sorted.map { version in
            [
                "versionId": version["versionId"] as? String ?? "",
                "createdAt": version["createdAt"] as? String ?? "",
            ]
        }

        let jsonData = try JSONSerialization.data(withJSONObject: versionDicts, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(entityId: input.entityId, versions: jsonString)
    }

    public func rollback(
        input: VersionRollbackInput,
        storage: ConceptStorage
    ) async throws -> VersionRollbackOutput {
        let key = "\(input.entityId):\(input.versionId)"
        guard try await storage.get(relation: "version_history", key: key) != nil else {
            return .versionNotfound(message: "Version '\(input.versionId)' for entity '\(input.entityId)' not found")
        }

        // In a real implementation, this would restore the entity to the snapshot state.
        // For this concept implementation, we confirm the version exists and return success.
        return .ok(entityId: input.entityId)
    }

    public func diff(
        input: VersionDiffInput,
        storage: ConceptStorage
    ) async throws -> VersionDiffOutput {
        let keyA = "\(input.entityId):\(input.versionA)"
        let keyB = "\(input.entityId):\(input.versionB)"

        guard let versionA = try await storage.get(relation: "version_history", key: keyA) else {
            return .notfound(message: "Version '\(input.versionA)' for entity '\(input.entityId)' not found")
        }

        guard let versionB = try await storage.get(relation: "version_history", key: keyB) else {
            return .notfound(message: "Version '\(input.versionB)' for entity '\(input.entityId)' not found")
        }

        let dataA = versionA["snapshotData"] as? String ?? ""
        let dataB = versionB["snapshotData"] as? String ?? ""

        let changes: [String: String] = [
            "versionA": input.versionA,
            "versionB": input.versionB,
            "dataA": dataA,
            "dataB": dataB,
            "changed": dataA != dataB ? "true" : "false",
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: changes, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"

        return .ok(entityId: input.entityId, changes: jsonString)
    }
}
