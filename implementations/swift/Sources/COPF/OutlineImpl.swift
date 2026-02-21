// OutlineImpl.swift — Outline concept implementation

import Foundation

// MARK: - Types

public struct OutlineIndentInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum OutlineIndentOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct OutlineOutdentInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum OutlineOutdentOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct OutlineReparentInput: Codable {
    public let nodeId: String
    public let newParentId: String
    public let position: Int

    public init(nodeId: String, newParentId: String, position: Int) {
        self.nodeId = nodeId
        self.newParentId = newParentId
        self.position = position
    }
}

public enum OutlineReparentOutput: Codable {
    case ok(nodeId: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        }
    }
}

public struct OutlineCollapseInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum OutlineCollapseOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct OutlineExpandInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum OutlineExpandOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct OutlineZoomInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum OutlineZoomOutput: Codable {
    case ok(nodeId: String, children: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, children, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                children: try container.decode(String.self, forKey: .children)
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
        case .ok(let nodeId, let children):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(children, forKey: .children)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol OutlineHandler {
    func indent(input: OutlineIndentInput, storage: ConceptStorage) async throws -> OutlineIndentOutput
    func outdent(input: OutlineOutdentInput, storage: ConceptStorage) async throws -> OutlineOutdentOutput
    func reparent(input: OutlineReparentInput, storage: ConceptStorage) async throws -> OutlineReparentOutput
    func collapse(input: OutlineCollapseInput, storage: ConceptStorage) async throws -> OutlineCollapseOutput
    func expand(input: OutlineExpandInput, storage: ConceptStorage) async throws -> OutlineExpandOutput
    func zoom(input: OutlineZoomInput, storage: ConceptStorage) async throws -> OutlineZoomOutput
}

// MARK: - Implementation

public struct OutlineHandlerImpl: OutlineHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func indent(
        input: OutlineIndentInput,
        storage: ConceptStorage
    ) async throws -> OutlineIndentOutput {
        guard var existing = try await storage.get(relation: "outline_node", key: input.nodeId) else {
            return .notfound(message: "Outline node '\(input.nodeId)' not found")
        }
        let currentDepth = existing["depth"] as? Int ?? 0
        existing["depth"] = currentDepth + 1
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "outline_node", key: input.nodeId, value: existing)
        return .ok(nodeId: input.nodeId)
    }

    public func outdent(
        input: OutlineOutdentInput,
        storage: ConceptStorage
    ) async throws -> OutlineOutdentOutput {
        guard var existing = try await storage.get(relation: "outline_node", key: input.nodeId) else {
            return .notfound(message: "Outline node '\(input.nodeId)' not found")
        }
        let currentDepth = existing["depth"] as? Int ?? 0
        existing["depth"] = max(0, currentDepth - 1)
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "outline_node", key: input.nodeId, value: existing)
        return .ok(nodeId: input.nodeId)
    }

    public func reparent(
        input: OutlineReparentInput,
        storage: ConceptStorage
    ) async throws -> OutlineReparentOutput {
        let now = iso8601Now()
        // Ensure the node exists or create it
        var existing = try await storage.get(relation: "outline_node", key: input.nodeId) ?? [
            "id": input.nodeId,
            "depth": 0,
            "collapsed": false,
            "createdAt": now,
        ]
        existing["parentId"] = input.newParentId
        existing["position"] = input.position
        existing["updatedAt"] = now
        try await storage.put(relation: "outline_node", key: input.nodeId, value: existing)
        return .ok(nodeId: input.nodeId)
    }

    public func collapse(
        input: OutlineCollapseInput,
        storage: ConceptStorage
    ) async throws -> OutlineCollapseOutput {
        guard var existing = try await storage.get(relation: "outline_node", key: input.nodeId) else {
            return .notfound(message: "Outline node '\(input.nodeId)' not found")
        }
        existing["collapsed"] = true
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "outline_node", key: input.nodeId, value: existing)
        return .ok(nodeId: input.nodeId)
    }

    public func expand(
        input: OutlineExpandInput,
        storage: ConceptStorage
    ) async throws -> OutlineExpandOutput {
        guard var existing = try await storage.get(relation: "outline_node", key: input.nodeId) else {
            return .notfound(message: "Outline node '\(input.nodeId)' not found")
        }
        existing["collapsed"] = false
        existing["updatedAt"] = iso8601Now()
        try await storage.put(relation: "outline_node", key: input.nodeId, value: existing)
        return .ok(nodeId: input.nodeId)
    }

    public func zoom(
        input: OutlineZoomInput,
        storage: ConceptStorage
    ) async throws -> OutlineZoomOutput {
        guard try await storage.get(relation: "outline_node", key: input.nodeId) != nil else {
            return .notfound(message: "Outline node '\(input.nodeId)' not found")
        }
        let children = try await storage.find(
            relation: "outline_node",
            criteria: ["parentId": input.nodeId]
        )
        let childIds = children.compactMap { $0["id"] as? String }
        if let encoded = try? JSONSerialization.data(withJSONObject: childIds),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(nodeId: input.nodeId, children: str)
        }
        return .ok(nodeId: input.nodeId, children: "[]")
    }
}
