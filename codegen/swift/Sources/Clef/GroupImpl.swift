// GroupImpl.swift — Group concept implementation

import Foundation

// MARK: - Types

public struct GroupCreateGroupInput: Codable {
    public let name: String
    public let groupType: String

    public init(name: String, groupType: String) {
        self.name = name
        self.groupType = groupType
    }
}

public enum GroupCreateGroupOutput: Codable {
    case ok(groupId: String)

    enum CodingKeys: String, CodingKey {
        case variant, groupId
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

public struct GroupAddMemberInput: Codable {
    public let groupId: String
    public let userId: String
    public let role: String

    public init(groupId: String, userId: String, role: String) {
        self.groupId = groupId
        self.userId = userId
        self.role = role
    }
}

public enum GroupAddMemberOutput: Codable {
    case ok(groupId: String, userId: String)
    case groupNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, groupId, userId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                groupId: try container.decode(String.self, forKey: .groupId),
                userId: try container.decode(String.self, forKey: .userId)
            )
        case "groupNotfound":
            self = .groupNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let groupId, let userId):
            try container.encode("ok", forKey: .variant)
            try container.encode(groupId, forKey: .groupId)
            try container.encode(userId, forKey: .userId)
        case .groupNotfound(let message):
            try container.encode("groupNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct GroupAddContentInput: Codable {
    public let groupId: String
    public let nodeId: String

    public init(groupId: String, nodeId: String) {
        self.groupId = groupId
        self.nodeId = nodeId
    }
}

public enum GroupAddContentOutput: Codable {
    case ok(groupId: String, nodeId: String)
    case groupNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, groupId, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                groupId: try container.decode(String.self, forKey: .groupId),
                nodeId: try container.decode(String.self, forKey: .nodeId)
            )
        case "groupNotfound":
            self = .groupNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let groupId, let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(groupId, forKey: .groupId)
            try container.encode(nodeId, forKey: .nodeId)
        case .groupNotfound(let message):
            try container.encode("groupNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct GroupCheckGroupAccessInput: Codable {
    public let groupId: String
    public let entityId: String
    public let operation: String
    public let userId: String

    public init(groupId: String, entityId: String, operation: String, userId: String) {
        self.groupId = groupId
        self.entityId = entityId
        self.operation = operation
        self.userId = userId
    }
}

public enum GroupCheckGroupAccessOutput: Codable {
    case ok(allowed: Bool)
    case groupNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, allowed, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(allowed: try container.decode(Bool.self, forKey: .allowed))
        case "groupNotfound":
            self = .groupNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let allowed):
            try container.encode("ok", forKey: .variant)
            try container.encode(allowed, forKey: .allowed)
        case .groupNotfound(let message):
            try container.encode("groupNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol GroupHandler {
    func createGroup(input: GroupCreateGroupInput, storage: ConceptStorage) async throws -> GroupCreateGroupOutput
    func addMember(input: GroupAddMemberInput, storage: ConceptStorage) async throws -> GroupAddMemberOutput
    func addContent(input: GroupAddContentInput, storage: ConceptStorage) async throws -> GroupAddContentOutput
    func checkGroupAccess(input: GroupCheckGroupAccessInput, storage: ConceptStorage) async throws -> GroupCheckGroupAccessOutput
}

// MARK: - Implementation

public struct GroupHandlerImpl: GroupHandler {
    public init() {}

    public func createGroup(
        input: GroupCreateGroupInput,
        storage: ConceptStorage
    ) async throws -> GroupCreateGroupOutput {
        let groupId = UUID().uuidString
        try await storage.put(
            relation: "group",
            key: groupId,
            value: [
                "groupId": groupId,
                "name": input.name,
                "groupType": input.groupType,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(groupId: groupId)
    }

    public func addMember(
        input: GroupAddMemberInput,
        storage: ConceptStorage
    ) async throws -> GroupAddMemberOutput {
        guard try await storage.get(relation: "group", key: input.groupId) != nil else {
            return .groupNotfound(message: "Group \(input.groupId) not found")
        }
        let memberKey = "\(input.groupId):\(input.userId)"
        try await storage.put(
            relation: "group_membership",
            key: memberKey,
            value: [
                "groupId": input.groupId,
                "userId": input.userId,
                "role": input.role,
                "joinedAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(groupId: input.groupId, userId: input.userId)
    }

    public func addContent(
        input: GroupAddContentInput,
        storage: ConceptStorage
    ) async throws -> GroupAddContentOutput {
        guard try await storage.get(relation: "group", key: input.groupId) != nil else {
            return .groupNotfound(message: "Group \(input.groupId) not found")
        }
        let contentKey = "\(input.groupId):\(input.nodeId)"
        try await storage.put(
            relation: "group_content",
            key: contentKey,
            value: [
                "groupId": input.groupId,
                "nodeId": input.nodeId,
                "addedAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(groupId: input.groupId, nodeId: input.nodeId)
    }

    public func checkGroupAccess(
        input: GroupCheckGroupAccessInput,
        storage: ConceptStorage
    ) async throws -> GroupCheckGroupAccessOutput {
        guard try await storage.get(relation: "group", key: input.groupId) != nil else {
            return .groupNotfound(message: "Group \(input.groupId) not found")
        }
        let memberKey = "\(input.groupId):\(input.userId)"
        let membership = try await storage.get(relation: "group_membership", key: memberKey)
        if membership == nil {
            return .ok(allowed: false)
        }
        let role = membership?["role"] as? String ?? ""
        // Admin can do anything; members can view
        let allowed: Bool
        switch input.operation {
        case "view":
            allowed = true
        case "edit":
            allowed = role == "admin" || role == "editor"
        case "delete":
            allowed = role == "admin"
        default:
            allowed = role == "admin"
        }
        return .ok(allowed: allowed)
    }
}
