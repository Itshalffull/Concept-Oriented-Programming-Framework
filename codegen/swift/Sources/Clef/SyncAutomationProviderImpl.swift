// SyncAutomationProviderImpl.swift — SyncAutomationProvider concept implementation

import Foundation

// MARK: - Types

public enum SyncAutomationProviderRegisterOutput: Codable {
    case ok(providerName: String)
    case alreadyRegistered(providerName: String)

    enum CodingKeys: String, CodingKey {
        case variant, providerName
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(providerName: try container.decode(String.self, forKey: .providerName))
        case "alreadyRegistered":
            self = .alreadyRegistered(providerName: try container.decode(String.self, forKey: .providerName))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let providerName):
            try container.encode("ok", forKey: .variant)
            try container.encode(providerName, forKey: .providerName)
        case .alreadyRegistered(let providerName):
            try container.encode("alreadyRegistered", forKey: .variant)
            try container.encode(providerName, forKey: .providerName)
        }
    }
}

public struct SyncAutomationProviderDefineInput: Codable {
    public let name: String
    public let sourceText: String
    public let author: String

    public init(name: String, sourceText: String, author: String) {
        self.name = name
        self.sourceText = sourceText
        self.author = author
    }
}

public enum SyncAutomationProviderDefineOutput: Codable {
    case ok(syncDefId: String, name: String, status: String)
    case alreadyExists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, syncDefId, name, status, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                syncDefId: try container.decode(String.self, forKey: .syncDefId),
                name: try container.decode(String.self, forKey: .name),
                status: try container.decode(String.self, forKey: .status)
            )
        case "alreadyExists":
            self = .alreadyExists(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let syncDefId, let name, let status):
            try container.encode("ok", forKey: .variant)
            try container.encode(syncDefId, forKey: .syncDefId)
            try container.encode(name, forKey: .name)
            try container.encode(status, forKey: .status)
        case .alreadyExists(let message):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncAutomationProviderValidateInput: Codable {
    public let syncDef: String

    public init(syncDef: String) {
        self.syncDef = syncDef
    }
}

public enum SyncAutomationProviderValidateOutput: Codable {
    case ok(syncDefId: String, status: String)
    case notFound(message: String)
    case invalidTransition(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, syncDefId, status, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                syncDefId: try container.decode(String.self, forKey: .syncDefId),
                status: try container.decode(String.self, forKey: .status)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        case "invalidTransition":
            self = .invalidTransition(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let syncDefId, let status):
            try container.encode("ok", forKey: .variant)
            try container.encode(syncDefId, forKey: .syncDefId)
            try container.encode(status, forKey: .status)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .invalidTransition(let message):
            try container.encode("invalidTransition", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncAutomationProviderActivateInput: Codable {
    public let syncDef: String

    public init(syncDef: String) {
        self.syncDef = syncDef
    }
}

public enum SyncAutomationProviderActivateOutput: Codable {
    case ok(syncDefId: String, status: String)
    case notFound(message: String)
    case invalidTransition(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, syncDefId, status, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                syncDefId: try container.decode(String.self, forKey: .syncDefId),
                status: try container.decode(String.self, forKey: .status)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        case "invalidTransition":
            self = .invalidTransition(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let syncDefId, let status):
            try container.encode("ok", forKey: .variant)
            try container.encode(syncDefId, forKey: .syncDefId)
            try container.encode(status, forKey: .status)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .invalidTransition(let message):
            try container.encode("invalidTransition", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncAutomationProviderSuspendInput: Codable {
    public let syncDef: String

    public init(syncDef: String) {
        self.syncDef = syncDef
    }
}

public enum SyncAutomationProviderSuspendOutput: Codable {
    case ok(syncDefId: String, status: String)
    case notFound(message: String)
    case invalidTransition(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, syncDefId, status, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                syncDefId: try container.decode(String.self, forKey: .syncDefId),
                status: try container.decode(String.self, forKey: .status)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        case "invalidTransition":
            self = .invalidTransition(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let syncDefId, let status):
            try container.encode("ok", forKey: .variant)
            try container.encode(syncDefId, forKey: .syncDefId)
            try container.encode(status, forKey: .status)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .invalidTransition(let message):
            try container.encode("invalidTransition", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncAutomationProviderExecuteInput: Codable {
    public let actionRef: String
    public let input: String

    public init(actionRef: String, input: String) {
        self.actionRef = actionRef
        self.input = input
    }
}

public enum SyncAutomationProviderExecuteOutput: Codable {
    case ok(actionRef: String, result: String)
    case notFound(message: String)
    case notActive(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, actionRef, result, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                actionRef: try container.decode(String.self, forKey: .actionRef),
                result: try container.decode(String.self, forKey: .result)
            )
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        case "notActive":
            self = .notActive(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let actionRef, let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(actionRef, forKey: .actionRef)
            try container.encode(result, forKey: .result)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .notActive(let message):
            try container.encode("notActive", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol SyncAutomationProviderHandler {
    func register(storage: ConceptStorage) async throws -> SyncAutomationProviderRegisterOutput
    func define(input: SyncAutomationProviderDefineInput, storage: ConceptStorage) async throws -> SyncAutomationProviderDefineOutput
    func validate(input: SyncAutomationProviderValidateInput, storage: ConceptStorage) async throws -> SyncAutomationProviderValidateOutput
    func activate(input: SyncAutomationProviderActivateInput, storage: ConceptStorage) async throws -> SyncAutomationProviderActivateOutput
    func suspend(input: SyncAutomationProviderSuspendInput, storage: ConceptStorage) async throws -> SyncAutomationProviderSuspendOutput
    func execute(input: SyncAutomationProviderExecuteInput, storage: ConceptStorage) async throws -> SyncAutomationProviderExecuteOutput
}

// MARK: - Implementation

public struct SyncAutomationProviderHandlerImpl: SyncAutomationProviderHandler {
    public init() {}

    private let providerName = "sync"

    // Status lifecycle: Draft -> Validated -> Active -> Suspended
    private static let validTransitions: [String: Set<String>] = [
        "Draft": ["Validated"],
        "Validated": ["Active"],
        "Active": ["Suspended"],
        "Suspended": ["Active"],
    ]

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func register(
        storage: ConceptStorage
    ) async throws -> SyncAutomationProviderRegisterOutput {
        if let _ = try await storage.get(relation: "automationProvider", key: providerName) {
            return .alreadyRegistered(providerName: providerName)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "automationProvider",
            key: providerName,
            value: [
                "name": providerName,
                "type": "sync",
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(providerName: providerName)
    }

    public func define(
        input: SyncAutomationProviderDefineInput,
        storage: ConceptStorage
    ) async throws -> SyncAutomationProviderDefineOutput {
        let existing = try await storage.find(
            relation: "syncAutomationDef",
            criteria: ["name": input.name]
        )
        if !existing.isEmpty {
            return .alreadyExists(message: "Sync definition '\(input.name)' already exists")
        }
        let syncDefId = UUID().uuidString
        let now = iso8601Now()
        try await storage.put(
            relation: "syncAutomationDef",
            key: syncDefId,
            value: [
                "syncDefId": syncDefId,
                "name": input.name,
                "sourceText": input.sourceText,
                "author": input.author,
                "status": "Draft",
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(syncDefId: syncDefId, name: input.name, status: "Draft")
    }

    public func validate(
        input: SyncAutomationProviderValidateInput,
        storage: ConceptStorage
    ) async throws -> SyncAutomationProviderValidateOutput {
        guard var record = try await storage.get(relation: "syncAutomationDef", key: input.syncDef) else {
            return .notFound(message: "Sync definition '\(input.syncDef)' not found")
        }
        let currentStatus = record["status"] as? String ?? "Draft"
        guard let allowed = Self.validTransitions[currentStatus], allowed.contains("Validated") else {
            return .invalidTransition(message: "Cannot transition from '\(currentStatus)' to 'Validated'")
        }
        let now = iso8601Now()
        record["status"] = "Validated"
        record["updatedAt"] = now
        try await storage.put(relation: "syncAutomationDef", key: input.syncDef, value: record)
        return .ok(syncDefId: input.syncDef, status: "Validated")
    }

    public func activate(
        input: SyncAutomationProviderActivateInput,
        storage: ConceptStorage
    ) async throws -> SyncAutomationProviderActivateOutput {
        guard var record = try await storage.get(relation: "syncAutomationDef", key: input.syncDef) else {
            return .notFound(message: "Sync definition '\(input.syncDef)' not found")
        }
        let currentStatus = record["status"] as? String ?? "Draft"
        guard let allowed = Self.validTransitions[currentStatus], allowed.contains("Active") else {
            return .invalidTransition(message: "Cannot transition from '\(currentStatus)' to 'Active'")
        }
        let now = iso8601Now()
        record["status"] = "Active"
        record["updatedAt"] = now
        try await storage.put(relation: "syncAutomationDef", key: input.syncDef, value: record)
        return .ok(syncDefId: input.syncDef, status: "Active")
    }

    public func suspend(
        input: SyncAutomationProviderSuspendInput,
        storage: ConceptStorage
    ) async throws -> SyncAutomationProviderSuspendOutput {
        guard var record = try await storage.get(relation: "syncAutomationDef", key: input.syncDef) else {
            return .notFound(message: "Sync definition '\(input.syncDef)' not found")
        }
        let currentStatus = record["status"] as? String ?? "Draft"
        guard let allowed = Self.validTransitions[currentStatus], allowed.contains("Suspended") else {
            return .invalidTransition(message: "Cannot transition from '\(currentStatus)' to 'Suspended'")
        }
        let now = iso8601Now()
        record["status"] = "Suspended"
        record["updatedAt"] = now
        try await storage.put(relation: "syncAutomationDef", key: input.syncDef, value: record)
        return .ok(syncDefId: input.syncDef, status: "Suspended")
    }

    public func execute(
        input: SyncAutomationProviderExecuteInput,
        storage: ConceptStorage
    ) async throws -> SyncAutomationProviderExecuteOutput {
        let defs = try await storage.find(
            relation: "syncAutomationDef",
            criteria: ["name": input.actionRef]
        )
        guard let def = defs.first else {
            return .notFound(message: "Sync definition '\(input.actionRef)' not found")
        }
        let status = def["status"] as? String ?? "Draft"
        guard status == "Active" else {
            return .notActive(message: "Sync definition '\(input.actionRef)' is '\(status)', must be 'Active' to execute")
        }
        let sourceText = def["sourceText"] as? String ?? ""
        let result = "sync:\(input.actionRef):\(sourceText.prefix(32)):\(input.input)"
        return .ok(actionRef: input.actionRef, result: result)
    }
}
