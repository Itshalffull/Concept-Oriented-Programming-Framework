// WorkflowImpl.swift — Workflow concept implementation

import Foundation

// MARK: - Types

public struct WorkflowDefineStateInput: Codable {
    public let workflowId: String
    public let name: String
    public let config: String

    public init(workflowId: String, name: String, config: String) {
        self.workflowId = workflowId
        self.name = name
        self.config = config
    }
}

public enum WorkflowDefineStateOutput: Codable {
    case ok(workflowId: String, stateName: String)

    enum CodingKeys: String, CodingKey {
        case variant, workflowId, stateName
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                workflowId: try container.decode(String.self, forKey: .workflowId),
                stateName: try container.decode(String.self, forKey: .stateName)
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
        case .ok(let workflowId, let stateName):
            try container.encode("ok", forKey: .variant)
            try container.encode(workflowId, forKey: .workflowId)
            try container.encode(stateName, forKey: .stateName)
        }
    }
}

public struct WorkflowDefineTransitionInput: Codable {
    public let workflowId: String
    public let fromState: String
    public let toState: String
    public let guard_: String

    enum CodingKeys: String, CodingKey {
        case workflowId, fromState, toState
        case guard_ = "guard"
    }

    public init(workflowId: String, fromState: String, toState: String, guard_: String) {
        self.workflowId = workflowId
        self.fromState = fromState
        self.toState = toState
        self.guard_ = guard_
    }
}

public enum WorkflowDefineTransitionOutput: Codable {
    case ok(workflowId: String)

    enum CodingKeys: String, CodingKey {
        case variant, workflowId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(workflowId: try container.decode(String.self, forKey: .workflowId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let workflowId):
            try container.encode("ok", forKey: .variant)
            try container.encode(workflowId, forKey: .workflowId)
        }
    }
}

public struct WorkflowTransitionInput: Codable {
    public let entityId: String
    public let workflowId: String
    public let targetState: String

    public init(entityId: String, workflowId: String, targetState: String) {
        self.entityId = entityId
        self.workflowId = workflowId
        self.targetState = targetState
    }
}

public enum WorkflowTransitionOutput: Codable {
    case ok(entityId: String, fromState: String, toState: String)
    case notAllowed(message: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, entityId, fromState, toState, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                fromState: try container.decode(String.self, forKey: .fromState),
                toState: try container.decode(String.self, forKey: .toState)
            )
        case "notAllowed":
            self = .notAllowed(message: try container.decode(String.self, forKey: .message))
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
        case .ok(let entityId, let fromState, let toState):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(fromState, forKey: .fromState)
            try container.encode(toState, forKey: .toState)
        case .notAllowed(let message):
            try container.encode("notAllowed", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct WorkflowGetCurrentStateInput: Codable {
    public let entityId: String
    public let workflowId: String

    public init(entityId: String, workflowId: String) {
        self.entityId = entityId
        self.workflowId = workflowId
    }
}

public enum WorkflowGetCurrentStateOutput: Codable {
    case ok(entityId: String, state: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, entityId, state, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                state: try container.decode(String.self, forKey: .state)
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
        case .ok(let entityId, let state):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(state, forKey: .state)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol WorkflowHandler {
    func defineState(input: WorkflowDefineStateInput, storage: ConceptStorage) async throws -> WorkflowDefineStateOutput
    func defineTransition(input: WorkflowDefineTransitionInput, storage: ConceptStorage) async throws -> WorkflowDefineTransitionOutput
    func transition(input: WorkflowTransitionInput, storage: ConceptStorage) async throws -> WorkflowTransitionOutput
    func getCurrentState(input: WorkflowGetCurrentStateInput, storage: ConceptStorage) async throws -> WorkflowGetCurrentStateOutput
}

// MARK: - Implementation

public struct WorkflowHandlerImpl: WorkflowHandler {
    public init() {}

    public func defineState(
        input: WorkflowDefineStateInput,
        storage: ConceptStorage
    ) async throws -> WorkflowDefineStateOutput {
        let stateKey = "\(input.workflowId):\(input.name)"
        try await storage.put(
            relation: "workflow",
            key: stateKey,
            value: [
                "workflowId": input.workflowId,
                "stateName": input.name,
                "config": input.config,
                "type": "state",
            ]
        )
        return .ok(workflowId: input.workflowId, stateName: input.name)
    }

    public func defineTransition(
        input: WorkflowDefineTransitionInput,
        storage: ConceptStorage
    ) async throws -> WorkflowDefineTransitionOutput {
        let transitionKey = "\(input.workflowId):\(input.fromState)->\(input.toState)"
        try await storage.put(
            relation: "workflow",
            key: transitionKey,
            value: [
                "workflowId": input.workflowId,
                "fromState": input.fromState,
                "toState": input.toState,
                "guard": input.guard_,
                "type": "transition",
            ]
        )
        return .ok(workflowId: input.workflowId)
    }

    public func transition(
        input: WorkflowTransitionInput,
        storage: ConceptStorage
    ) async throws -> WorkflowTransitionOutput {
        let stateKey = "\(input.entityId):\(input.workflowId)"
        let stateRecord = try await storage.get(relation: "workflow_state", key: stateKey)
        let currentState = stateRecord?["state"] as? String ?? ""

        if currentState.isEmpty && stateRecord == nil {
            return .notfound(message: "Entity \(input.entityId) has no state in workflow \(input.workflowId)")
        }

        // Check if transition is allowed
        let transitionKey = "\(input.workflowId):\(currentState)->\(input.targetState)"
        let transitionRecord = try await storage.get(relation: "workflow", key: transitionKey)
        guard transitionRecord != nil else {
            return .notAllowed(message: "Transition from \(currentState) to \(input.targetState) is not allowed")
        }

        let fromState = currentState
        try await storage.put(
            relation: "workflow_state",
            key: stateKey,
            value: [
                "entityId": input.entityId,
                "workflowId": input.workflowId,
                "state": input.targetState,
                "updatedAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(entityId: input.entityId, fromState: fromState, toState: input.targetState)
    }

    public func getCurrentState(
        input: WorkflowGetCurrentStateInput,
        storage: ConceptStorage
    ) async throws -> WorkflowGetCurrentStateOutput {
        let stateKey = "\(input.entityId):\(input.workflowId)"
        guard let record = try await storage.get(relation: "workflow_state", key: stateKey) else {
            return .notfound(message: "Entity \(input.entityId) has no state in workflow \(input.workflowId)")
        }
        let state = record["state"] as? String ?? ""
        return .ok(entityId: input.entityId, state: state)
    }
}
