// AutomationDispatchImpl.swift — AutomationDispatch concept implementation

import Foundation

// MARK: - Types

public struct AutomationDispatchDispatchInput: Codable {
    public let ruleRef: String
    public let providerName: String
    public let context: String

    public init(ruleRef: String, providerName: String, context: String) {
        self.ruleRef = ruleRef
        self.providerName = providerName
        self.context = context
    }
}

public enum AutomationDispatchDispatchOutput: Codable {
    case ok(dispatchId: String, ruleRef: String, providerName: String)
    case providerNotFound(message: String)
    case ruleNotFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, dispatchId, ruleRef, providerName, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                dispatchId: try container.decode(String.self, forKey: .dispatchId),
                ruleRef: try container.decode(String.self, forKey: .ruleRef),
                providerName: try container.decode(String.self, forKey: .providerName)
            )
        case "providerNotFound":
            self = .providerNotFound(message: try container.decode(String.self, forKey: .message))
        case "ruleNotFound":
            self = .ruleNotFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let dispatchId, let ruleRef, let providerName):
            try container.encode("ok", forKey: .variant)
            try container.encode(dispatchId, forKey: .dispatchId)
            try container.encode(ruleRef, forKey: .ruleRef)
            try container.encode(providerName, forKey: .providerName)
        case .providerNotFound(let message):
            try container.encode("providerNotFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .ruleNotFound(let message):
            try container.encode("ruleNotFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public enum AutomationDispatchListProvidersOutput: Codable {
    case ok(providers: [String])

    enum CodingKeys: String, CodingKey {
        case variant, providers
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(providers: try container.decode([String].self, forKey: .providers))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let providers):
            try container.encode("ok", forKey: .variant)
            try container.encode(providers, forKey: .providers)
        }
    }
}

// MARK: - Handler Protocol

public protocol AutomationDispatchHandler {
    func dispatch(input: AutomationDispatchDispatchInput, storage: ConceptStorage) async throws -> AutomationDispatchDispatchOutput
    func listProviders(storage: ConceptStorage) async throws -> AutomationDispatchListProvidersOutput
}

// MARK: - Implementation

public struct AutomationDispatchHandlerImpl: AutomationDispatchHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func dispatch(
        input: AutomationDispatchDispatchInput,
        storage: ConceptStorage
    ) async throws -> AutomationDispatchDispatchOutput {
        guard let _ = try await storage.get(relation: "automationProvider", key: input.providerName) else {
            return .providerNotFound(message: "Provider '\(input.providerName)' not found")
        }
        guard let _ = try await storage.get(relation: "automation_rule", key: input.ruleRef) else {
            return .ruleNotFound(message: "Rule '\(input.ruleRef)' not found")
        }
        let dispatchId = UUID().uuidString
        let now = iso8601Now()
        try await storage.put(
            relation: "automationDispatch",
            key: dispatchId,
            value: [
                "dispatchId": dispatchId,
                "ruleRef": input.ruleRef,
                "providerName": input.providerName,
                "context": input.context,
                "status": "dispatched",
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(dispatchId: dispatchId, ruleRef: input.ruleRef, providerName: input.providerName)
    }

    public func listProviders(
        storage: ConceptStorage
    ) async throws -> AutomationDispatchListProvidersOutput {
        let records = try await storage.find(relation: "automationProvider", criteria: nil)
        let names = records.compactMap { $0["name"] as? String }
        return .ok(providers: names)
    }
}
