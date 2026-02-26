// CanvasImpl.swift — Canvas concept implementation

import Foundation

// MARK: - Types

public struct CanvasAddNodeInput: Codable {
    public let nodeType: String
    public let positionX: Double
    public let positionY: Double
    public let content: String

    public init(nodeType: String, positionX: Double, positionY: Double, content: String) {
        self.nodeType = nodeType
        self.positionX = positionX
        self.positionY = positionY
        self.content = content
    }
}

public enum CanvasAddNodeOutput: Codable {
    case ok(nodeId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
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

public struct CanvasMoveNodeInput: Codable {
    public let nodeId: String
    public let newX: Double
    public let newY: Double

    public init(nodeId: String, newX: Double, newY: Double) {
        self.nodeId = nodeId
        self.newX = newX
        self.newY = newY
    }
}

public enum CanvasMoveNodeOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
        case message
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

public struct CanvasConnectNodesInput: Codable {
    public let fromId: String
    public let toId: String
    public let label: String

    public init(fromId: String, toId: String, label: String) {
        self.fromId = fromId
        self.toId = toId
        self.label = label
    }
}

public enum CanvasConnectNodesOutput: Codable {
    case ok(edgeId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case edgeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(edgeId: try container.decode(String.self, forKey: .edgeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let edgeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(edgeId, forKey: .edgeId)
        }
    }
}

public struct CanvasGroupNodesInput: Codable {
    public let nodeIds: String

    public init(nodeIds: String) {
        self.nodeIds = nodeIds
    }
}

public enum CanvasGroupNodesOutput: Codable {
    case ok(groupId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case groupId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(groupId: try container.decode(String.self, forKey: .groupId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let groupId):
            try container.encode("ok", forKey: .variant)
            try container.encode(groupId, forKey: .groupId)
        }
    }
}

// MARK: - Handler Protocol

public protocol CanvasHandler {
    func addNode(input: CanvasAddNodeInput, storage: ConceptStorage) async throws -> CanvasAddNodeOutput
    func moveNode(input: CanvasMoveNodeInput, storage: ConceptStorage) async throws -> CanvasMoveNodeOutput
    func connectNodes(input: CanvasConnectNodesInput, storage: ConceptStorage) async throws -> CanvasConnectNodesOutput
    func groupNodes(input: CanvasGroupNodesInput, storage: ConceptStorage) async throws -> CanvasGroupNodesOutput
}

// MARK: - Implementation

public struct CanvasHandlerImpl: CanvasHandler {
    public init() {}

    public func addNode(
        input: CanvasAddNodeInput,
        storage: ConceptStorage
    ) async throws -> CanvasAddNodeOutput {
        let nodeId = UUID().uuidString
        try await storage.put(
            relation: "canvas_node",
            key: nodeId,
            value: [
                "id": nodeId,
                "nodeType": input.nodeType,
                "positionX": input.positionX,
                "positionY": input.positionY,
                "content": input.content,
                "groupId": "",
            ]
        )
        return .ok(nodeId: nodeId)
    }

    public func moveNode(
        input: CanvasMoveNodeInput,
        storage: ConceptStorage
    ) async throws -> CanvasMoveNodeOutput {
        guard let existing = try await storage.get(relation: "canvas_node", key: input.nodeId) else {
            return .notfound(message: "Canvas node '\(input.nodeId)' not found")
        }

        var updated = existing
        updated["positionX"] = input.newX
        updated["positionY"] = input.newY
        try await storage.put(relation: "canvas_node", key: input.nodeId, value: updated)

        return .ok(nodeId: input.nodeId)
    }

    public func connectNodes(
        input: CanvasConnectNodesInput,
        storage: ConceptStorage
    ) async throws -> CanvasConnectNodesOutput {
        let edgeId = UUID().uuidString
        try await storage.put(
            relation: "canvas_edge",
            key: edgeId,
            value: [
                "id": edgeId,
                "fromId": input.fromId,
                "toId": input.toId,
                "label": input.label,
            ]
        )
        return .ok(edgeId: edgeId)
    }

    public func groupNodes(
        input: CanvasGroupNodesInput,
        storage: ConceptStorage
    ) async throws -> CanvasGroupNodesOutput {
        let groupId = UUID().uuidString

        // Parse node IDs from JSON string
        var nodeIdArray: [String] = []
        if let data = input.nodeIds.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            nodeIdArray = parsed
        }

        // Update each node's groupId
        for nodeId in nodeIdArray {
            if let existing = try await storage.get(relation: "canvas_node", key: nodeId) {
                var updated = existing
                updated["groupId"] = groupId
                try await storage.put(relation: "canvas_node", key: nodeId, value: updated)
            }
        }

        return .ok(groupId: groupId)
    }
}
