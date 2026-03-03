// GovernanceIdentityImpl.swift — Governance Identity suite: Membership, Role, Permission, SybilResistance, Attestation, AgenticDelegate

import Foundation

// MARK: - Membership Types

public struct MembershipJoinInput: Codable {
    public let polityId: String
    public let userId: String
    public let credential: String

    public init(polityId: String, userId: String, credential: String) {
        self.polityId = polityId
        self.userId = userId
        self.credential = credential
    }
}

public enum MembershipJoinOutput: Codable {
    case ok(polityId: String, memberId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, polityId, memberId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                polityId: try container.decode(String.self, forKey: .polityId),
                memberId: try container.decode(String.self, forKey: .memberId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let polityId, let memberId):
            try container.encode("ok", forKey: .variant)
            try container.encode(polityId, forKey: .polityId)
            try container.encode(memberId, forKey: .memberId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MembershipLeaveInput: Codable {
    public let polityId: String
    public let memberId: String

    public init(polityId: String, memberId: String) {
        self.polityId = polityId
        self.memberId = memberId
    }
}

public enum MembershipLeaveOutput: Codable {
    case ok(polityId: String, memberId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, polityId, memberId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                polityId: try container.decode(String.self, forKey: .polityId),
                memberId: try container.decode(String.self, forKey: .memberId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let polityId, let memberId):
            try container.encode("ok", forKey: .variant)
            try container.encode(polityId, forKey: .polityId)
            try container.encode(memberId, forKey: .memberId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MembershipSuspendInput: Codable {
    public let polityId: String
    public let memberId: String
    public let reason: String

    public init(polityId: String, memberId: String, reason: String) {
        self.polityId = polityId
        self.memberId = memberId
        self.reason = reason
    }
}

public enum MembershipSuspendOutput: Codable {
    case ok(polityId: String, memberId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, polityId, memberId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                polityId: try container.decode(String.self, forKey: .polityId),
                memberId: try container.decode(String.self, forKey: .memberId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let polityId, let memberId):
            try container.encode("ok", forKey: .variant)
            try container.encode(polityId, forKey: .polityId)
            try container.encode(memberId, forKey: .memberId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MembershipReinstateInput: Codable {
    public let polityId: String
    public let memberId: String

    public init(polityId: String, memberId: String) {
        self.polityId = polityId
        self.memberId = memberId
    }
}

public enum MembershipReinstateOutput: Codable {
    case ok(polityId: String, memberId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, polityId, memberId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                polityId: try container.decode(String.self, forKey: .polityId),
                memberId: try container.decode(String.self, forKey: .memberId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let polityId, let memberId):
            try container.encode("ok", forKey: .variant)
            try container.encode(polityId, forKey: .polityId)
            try container.encode(memberId, forKey: .memberId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MembershipKickInput: Codable {
    public let polityId: String
    public let memberId: String
    public let reason: String

    public init(polityId: String, memberId: String, reason: String) {
        self.polityId = polityId
        self.memberId = memberId
        self.reason = reason
    }
}

public enum MembershipKickOutput: Codable {
    case ok(polityId: String, memberId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, polityId, memberId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                polityId: try container.decode(String.self, forKey: .polityId),
                memberId: try container.decode(String.self, forKey: .memberId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let polityId, let memberId):
            try container.encode("ok", forKey: .variant)
            try container.encode(polityId, forKey: .polityId)
            try container.encode(memberId, forKey: .memberId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MembershipUpdateRulesInput: Codable {
    public let polityId: String
    public let rules: String

    public init(polityId: String, rules: String) {
        self.polityId = polityId
        self.rules = rules
    }
}

public enum MembershipUpdateRulesOutput: Codable {
    case ok(polityId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, polityId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(polityId: try container.decode(String.self, forKey: .polityId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let polityId):
            try container.encode("ok", forKey: .variant)
            try container.encode(polityId, forKey: .polityId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Role Types

public struct RoleCreateInput: Codable {
    public let polityId: String
    public let name: String
    public let permissions: String

    public init(polityId: String, name: String, permissions: String) {
        self.polityId = polityId
        self.name = name
        self.permissions = permissions
    }
}

public enum RoleCreateOutput: Codable {
    case ok(roleId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, roleId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(roleId: try container.decode(String.self, forKey: .roleId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let roleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(roleId, forKey: .roleId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct RoleAssignInput: Codable {
    public let roleId: String
    public let memberId: String

    public init(roleId: String, memberId: String) {
        self.roleId = roleId
        self.memberId = memberId
    }
}

public enum RoleAssignOutput: Codable {
    case ok(roleId: String, memberId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, roleId, memberId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                roleId: try container.decode(String.self, forKey: .roleId),
                memberId: try container.decode(String.self, forKey: .memberId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let roleId, let memberId):
            try container.encode("ok", forKey: .variant)
            try container.encode(roleId, forKey: .roleId)
            try container.encode(memberId, forKey: .memberId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct RoleRevokeInput: Codable {
    public let roleId: String
    public let memberId: String

    public init(roleId: String, memberId: String) {
        self.roleId = roleId
        self.memberId = memberId
    }
}

public enum RoleRevokeOutput: Codable {
    case ok(roleId: String, memberId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, roleId, memberId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                roleId: try container.decode(String.self, forKey: .roleId),
                memberId: try container.decode(String.self, forKey: .memberId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let roleId, let memberId):
            try container.encode("ok", forKey: .variant)
            try container.encode(roleId, forKey: .roleId)
            try container.encode(memberId, forKey: .memberId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct RoleCheckInput: Codable {
    public let roleId: String
    public let memberId: String

    public init(roleId: String, memberId: String) {
        self.roleId = roleId
        self.memberId = memberId
    }
}

public enum RoleCheckOutput: Codable {
    case ok(hasRole: Bool)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, hasRole, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(hasRole: try container.decode(Bool.self, forKey: .hasRole))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let hasRole):
            try container.encode("ok", forKey: .variant)
            try container.encode(hasRole, forKey: .hasRole)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct RoleDissolveInput: Codable {
    public let roleId: String

    public init(roleId: String) {
        self.roleId = roleId
    }
}

public enum RoleDissolveOutput: Codable {
    case ok(roleId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, roleId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(roleId: try container.decode(String.self, forKey: .roleId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let roleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(roleId, forKey: .roleId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Permission Types

public struct PermissionGrantInput: Codable {
    public let subjectId: String
    public let resource: String
    public let action: String

    public init(subjectId: String, resource: String, action: String) {
        self.subjectId = subjectId
        self.resource = resource
        self.action = action
    }
}

public enum PermissionGrantOutput: Codable {
    case ok(permissionId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, permissionId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(permissionId: try container.decode(String.self, forKey: .permissionId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let permissionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(permissionId, forKey: .permissionId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PermissionRevokeInput: Codable {
    public let permissionId: String

    public init(permissionId: String) {
        self.permissionId = permissionId
    }
}

public enum PermissionRevokeOutput: Codable {
    case ok(permissionId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, permissionId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(permissionId: try container.decode(String.self, forKey: .permissionId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let permissionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(permissionId, forKey: .permissionId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PermissionCheckInput: Codable {
    public let subjectId: String
    public let resource: String
    public let action: String

    public init(subjectId: String, resource: String, action: String) {
        self.subjectId = subjectId
        self.resource = resource
        self.action = action
    }
}

public enum PermissionCheckOutput: Codable {
    case ok(allowed: Bool)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, allowed, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(allowed: try container.decode(Bool.self, forKey: .allowed))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
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
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - SybilResistance Types

public struct SybilResistanceVerifyInput: Codable {
    public let userId: String
    public let proofType: String
    public let proof: String

    public init(userId: String, proofType: String, proof: String) {
        self.userId = userId
        self.proofType = proofType
        self.proof = proof
    }
}

public enum SybilResistanceVerifyOutput: Codable {
    case ok(userId: String, verified: Bool)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, verified, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                verified: try container.decode(Bool.self, forKey: .verified)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId, let verified):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(verified, forKey: .verified)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SybilResistanceChallengeInput: Codable {
    public let userId: String
    public let challengeType: String

    public init(userId: String, challengeType: String) {
        self.userId = userId
        self.challengeType = challengeType
    }
}

public enum SybilResistanceChallengeOutput: Codable {
    case ok(challengeId: String, challenge: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, challengeId, challenge, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                challengeId: try container.decode(String.self, forKey: .challengeId),
                challenge: try container.decode(String.self, forKey: .challenge)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let challengeId, let challenge):
            try container.encode("ok", forKey: .variant)
            try container.encode(challengeId, forKey: .challengeId)
            try container.encode(challenge, forKey: .challenge)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SybilResistanceResolveChallengeInput: Codable {
    public let challengeId: String
    public let response: String

    public init(challengeId: String, response: String) {
        self.challengeId = challengeId
        self.response = response
    }
}

public enum SybilResistanceResolveChallengeOutput: Codable {
    case ok(challengeId: String, passed: Bool)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, challengeId, passed, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                challengeId: try container.decode(String.self, forKey: .challengeId),
                passed: try container.decode(Bool.self, forKey: .passed)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let challengeId, let passed):
            try container.encode("ok", forKey: .variant)
            try container.encode(challengeId, forKey: .challengeId)
            try container.encode(passed, forKey: .passed)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Attestation Types

public struct AttestationAttestInput: Codable {
    public let subjectId: String
    public let claim: String
    public let evidence: String

    public init(subjectId: String, claim: String, evidence: String) {
        self.subjectId = subjectId
        self.claim = claim
        self.evidence = evidence
    }
}

public enum AttestationAttestOutput: Codable {
    case ok(attestationId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, attestationId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(attestationId: try container.decode(String.self, forKey: .attestationId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let attestationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(attestationId, forKey: .attestationId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AttestationRevokeInput: Codable {
    public let attestationId: String

    public init(attestationId: String) {
        self.attestationId = attestationId
    }
}

public enum AttestationRevokeOutput: Codable {
    case ok(attestationId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, attestationId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(attestationId: try container.decode(String.self, forKey: .attestationId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let attestationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(attestationId, forKey: .attestationId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AttestationVerifyInput: Codable {
    public let attestationId: String

    public init(attestationId: String) {
        self.attestationId = attestationId
    }
}

public enum AttestationVerifyOutput: Codable {
    case ok(attestationId: String, valid: Bool)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, attestationId, valid, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                attestationId: try container.decode(String.self, forKey: .attestationId),
                valid: try container.decode(Bool.self, forKey: .valid)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let attestationId, let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(attestationId, forKey: .attestationId)
            try container.encode(valid, forKey: .valid)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - AgenticDelegate Types

public struct AgenticDelegateRegisterInput: Codable {
    public let agentId: String
    public let capabilities: String
    public let autonomyLevel: String

    public init(agentId: String, capabilities: String, autonomyLevel: String) {
        self.agentId = agentId
        self.capabilities = capabilities
        self.autonomyLevel = autonomyLevel
    }
}

public enum AgenticDelegateRegisterOutput: Codable {
    case ok(delegateId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, delegateId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(delegateId: try container.decode(String.self, forKey: .delegateId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let delegateId):
            try container.encode("ok", forKey: .variant)
            try container.encode(delegateId, forKey: .delegateId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AgenticDelegateAssumeRoleInput: Codable {
    public let delegateId: String
    public let roleId: String

    public init(delegateId: String, roleId: String) {
        self.delegateId = delegateId
        self.roleId = roleId
    }
}

public enum AgenticDelegateAssumeRoleOutput: Codable {
    case ok(delegateId: String, roleId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, delegateId, roleId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                delegateId: try container.decode(String.self, forKey: .delegateId),
                roleId: try container.decode(String.self, forKey: .roleId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let delegateId, let roleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(delegateId, forKey: .delegateId)
            try container.encode(roleId, forKey: .roleId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AgenticDelegateReleaseRoleInput: Codable {
    public let delegateId: String
    public let roleId: String

    public init(delegateId: String, roleId: String) {
        self.delegateId = delegateId
        self.roleId = roleId
    }
}

public enum AgenticDelegateReleaseRoleOutput: Codable {
    case ok(delegateId: String, roleId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, delegateId, roleId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                delegateId: try container.decode(String.self, forKey: .delegateId),
                roleId: try container.decode(String.self, forKey: .roleId)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let delegateId, let roleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(delegateId, forKey: .delegateId)
            try container.encode(roleId, forKey: .roleId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AgenticDelegateProposeActionInput: Codable {
    public let delegateId: String
    public let action: String
    public let justification: String

    public init(delegateId: String, action: String, justification: String) {
        self.delegateId = delegateId
        self.action = action
        self.justification = justification
    }
}

public enum AgenticDelegateProposeActionOutput: Codable {
    case ok(proposalId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, proposalId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(proposalId: try container.decode(String.self, forKey: .proposalId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let proposalId):
            try container.encode("ok", forKey: .variant)
            try container.encode(proposalId, forKey: .proposalId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AgenticDelegateEscalateInput: Codable {
    public let delegateId: String
    public let issue: String
    public let severity: String

    public init(delegateId: String, issue: String, severity: String) {
        self.delegateId = delegateId
        self.issue = issue
        self.severity = severity
    }
}

public enum AgenticDelegateEscalateOutput: Codable {
    case ok(escalationId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, escalationId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(escalationId: try container.decode(String.self, forKey: .escalationId))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let escalationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(escalationId, forKey: .escalationId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AgenticDelegateUpdateAutonomyInput: Codable {
    public let delegateId: String
    public let autonomyLevel: String

    public init(delegateId: String, autonomyLevel: String) {
        self.delegateId = delegateId
        self.autonomyLevel = autonomyLevel
    }
}

public enum AgenticDelegateUpdateAutonomyOutput: Codable {
    case ok(delegateId: String, autonomyLevel: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, delegateId, autonomyLevel, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                delegateId: try container.decode(String.self, forKey: .delegateId),
                autonomyLevel: try container.decode(String.self, forKey: .autonomyLevel)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let delegateId, let autonomyLevel):
            try container.encode("ok", forKey: .variant)
            try container.encode(delegateId, forKey: .delegateId)
            try container.encode(autonomyLevel, forKey: .autonomyLevel)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocols

public protocol MembershipHandler {
    func join(input: MembershipJoinInput, storage: ConceptStorage) async throws -> MembershipJoinOutput
    func leave(input: MembershipLeaveInput, storage: ConceptStorage) async throws -> MembershipLeaveOutput
    func suspend(input: MembershipSuspendInput, storage: ConceptStorage) async throws -> MembershipSuspendOutput
    func reinstate(input: MembershipReinstateInput, storage: ConceptStorage) async throws -> MembershipReinstateOutput
    func kick(input: MembershipKickInput, storage: ConceptStorage) async throws -> MembershipKickOutput
    func updateRules(input: MembershipUpdateRulesInput, storage: ConceptStorage) async throws -> MembershipUpdateRulesOutput
}

public protocol RoleHandler {
    func create(input: RoleCreateInput, storage: ConceptStorage) async throws -> RoleCreateOutput
    func assign(input: RoleAssignInput, storage: ConceptStorage) async throws -> RoleAssignOutput
    func revoke(input: RoleRevokeInput, storage: ConceptStorage) async throws -> RoleRevokeOutput
    func check(input: RoleCheckInput, storage: ConceptStorage) async throws -> RoleCheckOutput
    func dissolve(input: RoleDissolveInput, storage: ConceptStorage) async throws -> RoleDissolveOutput
}

public protocol PermissionHandler {
    func grant(input: PermissionGrantInput, storage: ConceptStorage) async throws -> PermissionGrantOutput
    func revoke(input: PermissionRevokeInput, storage: ConceptStorage) async throws -> PermissionRevokeOutput
    func check(input: PermissionCheckInput, storage: ConceptStorage) async throws -> PermissionCheckOutput
}

public protocol SybilResistanceHandler {
    func verify(input: SybilResistanceVerifyInput, storage: ConceptStorage) async throws -> SybilResistanceVerifyOutput
    func challenge(input: SybilResistanceChallengeInput, storage: ConceptStorage) async throws -> SybilResistanceChallengeOutput
    func resolveChallenge(input: SybilResistanceResolveChallengeInput, storage: ConceptStorage) async throws -> SybilResistanceResolveChallengeOutput
}

public protocol AttestationHandler {
    func attest(input: AttestationAttestInput, storage: ConceptStorage) async throws -> AttestationAttestOutput
    func revoke(input: AttestationRevokeInput, storage: ConceptStorage) async throws -> AttestationRevokeOutput
    func verify(input: AttestationVerifyInput, storage: ConceptStorage) async throws -> AttestationVerifyOutput
}

public protocol AgenticDelegateHandler {
    func register(input: AgenticDelegateRegisterInput, storage: ConceptStorage) async throws -> AgenticDelegateRegisterOutput
    func assumeRole(input: AgenticDelegateAssumeRoleInput, storage: ConceptStorage) async throws -> AgenticDelegateAssumeRoleOutput
    func releaseRole(input: AgenticDelegateReleaseRoleInput, storage: ConceptStorage) async throws -> AgenticDelegateReleaseRoleOutput
    func proposeAction(input: AgenticDelegateProposeActionInput, storage: ConceptStorage) async throws -> AgenticDelegateProposeActionOutput
    func escalate(input: AgenticDelegateEscalateInput, storage: ConceptStorage) async throws -> AgenticDelegateEscalateOutput
    func updateAutonomy(input: AgenticDelegateUpdateAutonomyInput, storage: ConceptStorage) async throws -> AgenticDelegateUpdateAutonomyOutput
}

// MARK: - Stub Implementations

public struct MembershipHandlerImpl: MembershipHandler {
    public init() {}

    public func join(input: MembershipJoinInput, storage: ConceptStorage) async throws -> MembershipJoinOutput {
        // TODO: implement handler
        return .ok(polityId: input.polityId, memberId: input.userId)
    }

    public func leave(input: MembershipLeaveInput, storage: ConceptStorage) async throws -> MembershipLeaveOutput {
        // TODO: implement handler
        return .ok(polityId: input.polityId, memberId: input.memberId)
    }

    public func suspend(input: MembershipSuspendInput, storage: ConceptStorage) async throws -> MembershipSuspendOutput {
        // TODO: implement handler
        return .ok(polityId: input.polityId, memberId: input.memberId)
    }

    public func reinstate(input: MembershipReinstateInput, storage: ConceptStorage) async throws -> MembershipReinstateOutput {
        // TODO: implement handler
        return .ok(polityId: input.polityId, memberId: input.memberId)
    }

    public func kick(input: MembershipKickInput, storage: ConceptStorage) async throws -> MembershipKickOutput {
        // TODO: implement handler
        return .ok(polityId: input.polityId, memberId: input.memberId)
    }

    public func updateRules(input: MembershipUpdateRulesInput, storage: ConceptStorage) async throws -> MembershipUpdateRulesOutput {
        // TODO: implement handler
        return .ok(polityId: input.polityId)
    }
}

public struct RoleHandlerImpl: RoleHandler {
    public init() {}

    public func create(input: RoleCreateInput, storage: ConceptStorage) async throws -> RoleCreateOutput {
        // TODO: implement handler
        return .ok(roleId: "\(input.polityId):\(input.name)")
    }

    public func assign(input: RoleAssignInput, storage: ConceptStorage) async throws -> RoleAssignOutput {
        // TODO: implement handler
        return .ok(roleId: input.roleId, memberId: input.memberId)
    }

    public func revoke(input: RoleRevokeInput, storage: ConceptStorage) async throws -> RoleRevokeOutput {
        // TODO: implement handler
        return .ok(roleId: input.roleId, memberId: input.memberId)
    }

    public func check(input: RoleCheckInput, storage: ConceptStorage) async throws -> RoleCheckOutput {
        // TODO: implement handler
        return .ok(hasRole: false)
    }

    public func dissolve(input: RoleDissolveInput, storage: ConceptStorage) async throws -> RoleDissolveOutput {
        // TODO: implement handler
        return .ok(roleId: input.roleId)
    }
}

public struct PermissionHandlerImpl: PermissionHandler {
    public init() {}

    public func grant(input: PermissionGrantInput, storage: ConceptStorage) async throws -> PermissionGrantOutput {
        // TODO: implement handler
        return .ok(permissionId: "\(input.subjectId):\(input.resource):\(input.action)")
    }

    public func revoke(input: PermissionRevokeInput, storage: ConceptStorage) async throws -> PermissionRevokeOutput {
        // TODO: implement handler
        return .ok(permissionId: input.permissionId)
    }

    public func check(input: PermissionCheckInput, storage: ConceptStorage) async throws -> PermissionCheckOutput {
        // TODO: implement handler
        return .ok(allowed: false)
    }
}

public struct SybilResistanceHandlerImpl: SybilResistanceHandler {
    public init() {}

    public func verify(input: SybilResistanceVerifyInput, storage: ConceptStorage) async throws -> SybilResistanceVerifyOutput {
        // TODO: implement handler
        return .ok(userId: input.userId, verified: false)
    }

    public func challenge(input: SybilResistanceChallengeInput, storage: ConceptStorage) async throws -> SybilResistanceChallengeOutput {
        // TODO: implement handler
        return .ok(challengeId: "challenge-stub", challenge: "pending")
    }

    public func resolveChallenge(input: SybilResistanceResolveChallengeInput, storage: ConceptStorage) async throws -> SybilResistanceResolveChallengeOutput {
        // TODO: implement handler
        return .ok(challengeId: input.challengeId, passed: false)
    }
}

public struct AttestationHandlerImpl: AttestationHandler {
    public init() {}

    public func attest(input: AttestationAttestInput, storage: ConceptStorage) async throws -> AttestationAttestOutput {
        // TODO: implement handler
        return .ok(attestationId: "att-stub")
    }

    public func revoke(input: AttestationRevokeInput, storage: ConceptStorage) async throws -> AttestationRevokeOutput {
        // TODO: implement handler
        return .ok(attestationId: input.attestationId)
    }

    public func verify(input: AttestationVerifyInput, storage: ConceptStorage) async throws -> AttestationVerifyOutput {
        // TODO: implement handler
        return .ok(attestationId: input.attestationId, valid: false)
    }
}

public struct AgenticDelegateHandlerImpl: AgenticDelegateHandler {
    public init() {}

    public func register(input: AgenticDelegateRegisterInput, storage: ConceptStorage) async throws -> AgenticDelegateRegisterOutput {
        // TODO: implement handler
        return .ok(delegateId: "del-stub")
    }

    public func assumeRole(input: AgenticDelegateAssumeRoleInput, storage: ConceptStorage) async throws -> AgenticDelegateAssumeRoleOutput {
        // TODO: implement handler
        return .ok(delegateId: input.delegateId, roleId: input.roleId)
    }

    public func releaseRole(input: AgenticDelegateReleaseRoleInput, storage: ConceptStorage) async throws -> AgenticDelegateReleaseRoleOutput {
        // TODO: implement handler
        return .ok(delegateId: input.delegateId, roleId: input.roleId)
    }

    public func proposeAction(input: AgenticDelegateProposeActionInput, storage: ConceptStorage) async throws -> AgenticDelegateProposeActionOutput {
        // TODO: implement handler
        return .ok(proposalId: "prop-stub")
    }

    public func escalate(input: AgenticDelegateEscalateInput, storage: ConceptStorage) async throws -> AgenticDelegateEscalateOutput {
        // TODO: implement handler
        return .ok(escalationId: "esc-stub")
    }

    public func updateAutonomy(input: AgenticDelegateUpdateAutonomyInput, storage: ConceptStorage) async throws -> AgenticDelegateUpdateAutonomyOutput {
        // TODO: implement handler
        return .ok(delegateId: input.delegateId, autonomyLevel: input.autonomyLevel)
    }
}
