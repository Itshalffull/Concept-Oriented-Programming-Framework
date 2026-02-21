// GraphImpl.swift — Graph concept implementation

import Foundation

// MARK: - Types

public struct GraphAddNodeInput: Codable {
    public let entityId: String

    public init(entityId: String) {
        self.entityId = entityId
    }
}

public enum GraphAddNodeOutput: Codable {
    case ok(entityId: String)
    case alreadyExists(message: String)

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
        case .ok(let entityId):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
        case .alreadyExists(let message):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct GraphRemoveNodeInput: Codable {
    public let entityId: String

    public init(entityId: String) {
        self.entityId = entityId
    }
}

public enum GraphRemoveNodeOutput: Codable {
    case ok(entityId: String)
    case notfound(message: String)

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
        case .ok(let entityId):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct GraphAddEdgeInput: Codable {
    public let sourceId: String
    public let targetId: String

    public init(sourceId: String, targetId: String) {
        self.sourceId = sourceId
        self.targetId = targetId
    }
}

public enum GraphAddEdgeOutput: Codable {
    case ok(sourceId: String, targetId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case sourceId
        case targetId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sourceId: try container.decode(String.self, forKey: .sourceId),
                targetId: try container.decode(String.self, forKey: .targetId)
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
        case .ok(let sourceId, let targetId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sourceId, forKey: .sourceId)
            try container.encode(targetId, forKey: .targetId)
        }
    }
}

public struct GraphRemoveEdgeInput: Codable {
    public let sourceId: String
    public let targetId: String

    public init(sourceId: String, targetId: String) {
        self.sourceId = sourceId
        self.targetId = targetId
    }
}

public enum GraphRemoveEdgeOutput: Codable {
    case ok(sourceId: String, targetId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case sourceId
        case targetId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sourceId: try container.decode(String.self, forKey: .sourceId),
                targetId: try container.decode(String.self, forKey: .targetId)
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
        case .ok(let sourceId, let targetId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sourceId, forKey: .sourceId)
            try container.encode(targetId, forKey: .targetId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct GraphGetNeighborsInput: Codable {
    public let entityId: String
    public let depth: Int

    public init(entityId: String, depth: Int) {
        self.entityId = entityId
        self.depth = depth
    }
}

public enum GraphGetNeighborsOutput: Codable {
    case ok(entityId: String, neighbors: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entityId
        case neighbors
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                neighbors: try container.decode(String.self, forKey: .neighbors)
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
        case .ok(let entityId, let neighbors):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(neighbors, forKey: .neighbors)
        }
    }
}

// MARK: - Handler Protocol

public protocol GraphHandler {
    func addNode(input: GraphAddNodeInput, storage: ConceptStorage) async throws -> GraphAddNodeOutput
    func removeNode(input: GraphRemoveNodeInput, storage: ConceptStorage) async throws -> GraphRemoveNodeOutput
    func addEdge(input: GraphAddEdgeInput, storage: ConceptStorage) async throws -> GraphAddEdgeOutput
    func removeEdge(input: GraphRemoveEdgeInput, storage: ConceptStorage) async throws -> GraphRemoveEdgeOutput
    func getNeighbors(input: GraphGetNeighborsInput, storage: ConceptStorage) async throws -> GraphGetNeighborsOutput
}

// MARK: - Implementation

public struct GraphHandlerImpl: GraphHandler {
    public init() {}

    public func addNode(
        input: GraphAddNodeInput,
        storage: ConceptStorage
    ) async throws -> GraphAddNodeOutput {
        if try await storage.get(relation: "graph_node", key: input.entityId) != nil {
            return .alreadyExists(message: "Node '\(input.entityId)' already exists")
        }

        try await storage.put(
            relation: "graph_node",
            key: input.entityId,
            value: [
                "entityId": input.entityId,
            ]
        )

        return .ok(entityId: input.entityId)
    }

    public func removeNode(
        input: GraphRemoveNodeInput,
        storage: ConceptStorage
    ) async throws -> GraphRemoveNodeOutput {
        guard try await storage.get(relation: "graph_node", key: input.entityId) != nil else {
            return .notfound(message: "Node '\(input.entityId)' not found")
        }

        try await storage.del(relation: "graph_node", key: input.entityId)

        // Remove all edges involving this node
        let allEdges = try await storage.find(relation: "graph_edge", criteria: nil)
        for edge in allEdges {
            let sourceId = edge["sourceId"] as? String ?? ""
            let targetId = edge["targetId"] as? String ?? ""
            if sourceId == input.entityId || targetId == input.entityId {
                let edgeKey = "\(sourceId):\(targetId)"
                try await storage.del(relation: "graph_edge", key: edgeKey)
            }
        }

        return .ok(entityId: input.entityId)
    }

    public func addEdge(
        input: GraphAddEdgeInput,
        storage: ConceptStorage
    ) async throws -> GraphAddEdgeOutput {
        let edgeKey = "\(input.sourceId):\(input.targetId)"
        try await storage.put(
            relation: "graph_edge",
            key: edgeKey,
            value: [
                "sourceId": input.sourceId,
                "targetId": input.targetId,
            ]
        )

        return .ok(sourceId: input.sourceId, targetId: input.targetId)
    }

    public func removeEdge(
        input: GraphRemoveEdgeInput,
        storage: ConceptStorage
    ) async throws -> GraphRemoveEdgeOutput {
        let edgeKey = "\(input.sourceId):\(input.targetId)"
        guard try await storage.get(relation: "graph_edge", key: edgeKey) != nil else {
            return .notfound(message: "Edge from '\(input.sourceId)' to '\(input.targetId)' not found")
        }

        try await storage.del(relation: "graph_edge", key: edgeKey)
        return .ok(sourceId: input.sourceId, targetId: input.targetId)
    }

    public func getNeighbors(
        input: GraphGetNeighborsInput,
        storage: ConceptStorage
    ) async throws -> GraphGetNeighborsOutput {
        var visited = Set<String>()
        var frontier = Set([input.entityId])

        for _ in 0..<input.depth {
            var nextFrontier = Set<String>()
            let allEdges = try await storage.find(relation: "graph_edge", criteria: nil)
            for nodeId in frontier {
                for edge in allEdges {
                    let sourceId = edge["sourceId"] as? String ?? ""
                    let targetId = edge["targetId"] as? String ?? ""
                    if sourceId == nodeId && !visited.contains(targetId) && targetId != input.entityId {
                        nextFrontier.insert(targetId)
                    }
                    if targetId == nodeId && !visited.contains(sourceId) && sourceId != input.entityId {
                        nextFrontier.insert(sourceId)
                    }
                }
            }
            visited.formUnion(frontier)
            frontier = nextFrontier.subtracting(visited)
            if frontier.isEmpty { break }
        }

        visited.formUnion(frontier)
        visited.remove(input.entityId)

        let neighborArray = Array(visited).sorted()
        let jsonData = try JSONSerialization.data(withJSONObject: neighborArray, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(entityId: input.entityId, neighbors: jsonString)
    }
}
