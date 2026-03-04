// AutomationTargetImpl.swift — AutomationTarget concept implementation

import Foundation

// MARK: - Types

public struct AutomationTargetGenerateInput: Codable {
    public let projection: String
    public let config: String

    public init(projection: String, config: String) {
        self.projection = projection
        self.config = config
    }
}

public enum AutomationTargetGenerateOutput: Codable {
    case ok(targetId: String, projection: String, entryCount: Int)
    case invalidProjection(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, targetId, projection, entryCount, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                targetId: try container.decode(String.self, forKey: .targetId),
                projection: try container.decode(String.self, forKey: .projection),
                entryCount: try container.decode(Int.self, forKey: .entryCount)
            )
        case "invalidProjection":
            self = .invalidProjection(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let targetId, let projection, let entryCount):
            try container.encode("ok", forKey: .variant)
            try container.encode(targetId, forKey: .targetId)
            try container.encode(projection, forKey: .projection)
            try container.encode(entryCount, forKey: .entryCount)
        case .invalidProjection(let message):
            try container.encode("invalidProjection", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationTargetValidateInput: Codable {
    public let manifest: String

    public init(manifest: String) {
        self.manifest = manifest
    }
}

public enum AutomationTargetValidateOutput: Codable {
    case ok(manifest: String, valid: Bool, errorCount: Int)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, manifest, valid, errorCount, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                manifest: try container.decode(String.self, forKey: .manifest),
                valid: try container.decode(Bool.self, forKey: .valid),
                errorCount: try container.decode(Int.self, forKey: .errorCount)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let manifest, let valid, let errorCount):
            try container.encode("ok", forKey: .variant)
            try container.encode(manifest, forKey: .manifest)
            try container.encode(valid, forKey: .valid)
            try container.encode(errorCount, forKey: .errorCount)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AutomationTargetListEntriesInput: Codable {
    public let manifest: String

    public init(manifest: String) {
        self.manifest = manifest
    }
}

public enum AutomationTargetListEntriesOutput: Codable {
    case ok(manifest: String, entries: [String])
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, manifest, entries, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                manifest: try container.decode(String.self, forKey: .manifest),
                entries: try container.decode([String].self, forKey: .entries)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let manifest, let entries):
            try container.encode("ok", forKey: .variant)
            try container.encode(manifest, forKey: .manifest)
            try container.encode(entries, forKey: .entries)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol AutomationTargetHandler {
    func generate(input: AutomationTargetGenerateInput, storage: ConceptStorage) async throws -> AutomationTargetGenerateOutput
    func validate(input: AutomationTargetValidateInput, storage: ConceptStorage) async throws -> AutomationTargetValidateOutput
    func listEntries(input: AutomationTargetListEntriesInput, storage: ConceptStorage) async throws -> AutomationTargetListEntriesOutput
}

// MARK: - Implementation

public struct AutomationTargetHandlerImpl: AutomationTargetHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func generate(
        input: AutomationTargetGenerateInput,
        storage: ConceptStorage
    ) async throws -> AutomationTargetGenerateOutput {
        guard !input.projection.isEmpty else {
            return .invalidProjection(message: "Projection cannot be empty")
        }
        let targetId = UUID().uuidString
        let now = iso8601Now()
        try await storage.put(
            relation: "automationTarget",
            key: targetId,
            value: [
                "targetId": targetId,
                "projection": input.projection,
                "config": input.config,
                "entryCount": 0,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        // Create an initial manifest for the generated target
        let manifestId = UUID().uuidString
        try await storage.put(
            relation: "automationTargetManifest",
            key: manifestId,
            value: [
                "manifestId": manifestId,
                "targetId": targetId,
                "projection": input.projection,
                "valid": true,
                "errorCount": 0,
                "createdAt": now,
            ]
        )
        return .ok(targetId: targetId, projection: input.projection, entryCount: 0)
    }

    public func validate(
        input: AutomationTargetValidateInput,
        storage: ConceptStorage
    ) async throws -> AutomationTargetValidateOutput {
        guard let record = try await storage.get(relation: "automationTargetManifest", key: input.manifest) else {
            return .notFound(message: "Manifest '\(input.manifest)' not found")
        }
        let entries = try await storage.find(
            relation: "automationTargetEntry",
            criteria: ["manifestId": input.manifest]
        )
        // Validate each entry has required fields
        var errorCount = 0
        for entry in entries {
            if entry["actionRef"] == nil { errorCount += 1 }
        }
        let valid = errorCount == 0
        let now = iso8601Now()
        var updated = record
        updated["valid"] = valid
        updated["errorCount"] = errorCount
        updated["validatedAt"] = now
        try await storage.put(relation: "automationTargetManifest", key: input.manifest, value: updated)
        let manifestName = record["projection"] as? String ?? input.manifest
        return .ok(manifest: manifestName, valid: valid, errorCount: errorCount)
    }

    public func listEntries(
        input: AutomationTargetListEntriesInput,
        storage: ConceptStorage
    ) async throws -> AutomationTargetListEntriesOutput {
        guard let _ = try await storage.get(relation: "automationTargetManifest", key: input.manifest) else {
            return .notFound(message: "Manifest '\(input.manifest)' not found")
        }
        let entries = try await storage.find(
            relation: "automationTargetEntry",
            criteria: ["manifestId": input.manifest]
        )
        let actionRefs = entries.compactMap { $0["actionRef"] as? String }
        let manifestLabel = input.manifest
        return .ok(manifest: manifestLabel, entries: actionRefs)
    }
}
