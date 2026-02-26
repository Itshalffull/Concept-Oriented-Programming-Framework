// FileManagementImpl.swift — FileManagement concept implementation

import Foundation

// MARK: - Types

public struct FileManagementUploadInput: Codable {
    public let fileId: String
    public let destination: String
    public let metadata: String

    public init(fileId: String, destination: String, metadata: String) {
        self.fileId = fileId
        self.destination = destination
        self.metadata = metadata
    }
}

public enum FileManagementUploadOutput: Codable {
    case ok(fileId: String)

    enum CodingKeys: String, CodingKey {
        case variant, fileId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(fileId: try container.decode(String.self, forKey: .fileId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let fileId):
            try container.encode("ok", forKey: .variant)
            try container.encode(fileId, forKey: .fileId)
        }
    }
}

public struct FileManagementAddUsageInput: Codable {
    public let fileId: String
    public let entityId: String

    public init(fileId: String, entityId: String) {
        self.fileId = fileId
        self.entityId = entityId
    }
}

public enum FileManagementAddUsageOutput: Codable {
    case ok(fileId: String)
    case fileNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, fileId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(fileId: try container.decode(String.self, forKey: .fileId))
        case "fileNotfound":
            self = .fileNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let fileId):
            try container.encode("ok", forKey: .variant)
            try container.encode(fileId, forKey: .fileId)
        case .fileNotfound(let message):
            try container.encode("fileNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FileManagementRemoveUsageInput: Codable {
    public let fileId: String
    public let entityId: String

    public init(fileId: String, entityId: String) {
        self.fileId = fileId
        self.entityId = entityId
    }
}

public enum FileManagementRemoveUsageOutput: Codable {
    case ok(fileId: String)
    case fileNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, fileId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(fileId: try container.decode(String.self, forKey: .fileId))
        case "fileNotfound":
            self = .fileNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let fileId):
            try container.encode("ok", forKey: .variant)
            try container.encode(fileId, forKey: .fileId)
        case .fileNotfound(let message):
            try container.encode("fileNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct FileManagementGarbageCollectInput: Codable {
    public init() {}
}

public enum FileManagementGarbageCollectOutput: Codable {
    case ok(removedCount: Int)

    enum CodingKeys: String, CodingKey {
        case variant, removedCount
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(removedCount: try container.decode(Int.self, forKey: .removedCount))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let removedCount):
            try container.encode("ok", forKey: .variant)
            try container.encode(removedCount, forKey: .removedCount)
        }
    }
}

// MARK: - Handler Protocol

public protocol FileManagementHandler {
    func upload(input: FileManagementUploadInput, storage: ConceptStorage) async throws -> FileManagementUploadOutput
    func addUsage(input: FileManagementAddUsageInput, storage: ConceptStorage) async throws -> FileManagementAddUsageOutput
    func removeUsage(input: FileManagementRemoveUsageInput, storage: ConceptStorage) async throws -> FileManagementRemoveUsageOutput
    func garbageCollect(input: FileManagementGarbageCollectInput, storage: ConceptStorage) async throws -> FileManagementGarbageCollectOutput
}

// MARK: - Implementation

public struct FileManagementHandlerImpl: FileManagementHandler {
    public init() {}

    public func upload(
        input: FileManagementUploadInput,
        storage: ConceptStorage
    ) async throws -> FileManagementUploadOutput {
        try await storage.put(
            relation: "file",
            key: input.fileId,
            value: [
                "fileId": input.fileId,
                "destination": input.destination,
                "metadata": input.metadata,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(fileId: input.fileId)
    }

    public func addUsage(
        input: FileManagementAddUsageInput,
        storage: ConceptStorage
    ) async throws -> FileManagementAddUsageOutput {
        guard try await storage.get(relation: "file", key: input.fileId) != nil else {
            return .fileNotfound(message: "File \(input.fileId) not found")
        }
        let usageKey = "\(input.fileId):\(input.entityId)"
        try await storage.put(
            relation: "file_usage",
            key: usageKey,
            value: [
                "fileId": input.fileId,
                "entityId": input.entityId,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(fileId: input.fileId)
    }

    public func removeUsage(
        input: FileManagementRemoveUsageInput,
        storage: ConceptStorage
    ) async throws -> FileManagementRemoveUsageOutput {
        guard try await storage.get(relation: "file", key: input.fileId) != nil else {
            return .fileNotfound(message: "File \(input.fileId) not found")
        }
        let usageKey = "\(input.fileId):\(input.entityId)"
        try await storage.del(relation: "file_usage", key: usageKey)
        return .ok(fileId: input.fileId)
    }

    public func garbageCollect(
        input: FileManagementGarbageCollectInput,
        storage: ConceptStorage
    ) async throws -> FileManagementGarbageCollectOutput {
        let allFiles = try await storage.find(relation: "file", criteria: nil)
        let allUsages = try await storage.find(relation: "file_usage", criteria: nil)
        let usedFileIds = Set(allUsages.compactMap { $0["fileId"] as? String })
        var removedCount = 0
        for file in allFiles {
            let fileId = file["fileId"] as? String ?? ""
            if !usedFileIds.contains(fileId) {
                try await storage.del(relation: "file", key: fileId)
                removedCount += 1
            }
        }
        return .ok(removedCount: removedCount)
    }
}
