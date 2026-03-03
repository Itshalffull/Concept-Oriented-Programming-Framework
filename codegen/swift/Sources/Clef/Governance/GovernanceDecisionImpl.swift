// GovernanceDecisionImpl.swift — Governance Decision suite: Proposal, Vote, CountingMethod, Quorum, Conviction, PredictionMarket, OptimisticApproval, Deliberation, Meeting

import Foundation

// MARK: - Proposal Types

public struct ProposalCreateInput: Codable {
    public let polityId: String
    public let title: String
    public let body: String
    public let authorId: String

    public init(polityId: String, title: String, body: String, authorId: String) {
        self.polityId = polityId
        self.title = title
        self.body = body
        self.authorId = authorId
    }
}

public enum ProposalCreateOutput: Codable {
    case ok(proposalId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, proposalId, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let proposalId):
            try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct ProposalSponsorInput: Codable {
    public let proposalId: String
    public let sponsorId: String
    public init(proposalId: String, sponsorId: String) { self.proposalId = proposalId; self.sponsorId = sponsorId }
}

public enum ProposalSponsorOutput: Codable {
    case ok(proposalId: String, sponsorId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, proposalId, sponsorId, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId), sponsorId: try c.decode(String.self, forKey: .sponsorId))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let proposalId, let sponsorId):
            try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId); try c.encode(sponsorId, forKey: .sponsorId)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct ProposalActivateInput: Codable {
    public let proposalId: String
    public init(proposalId: String) { self.proposalId = proposalId }
}

public enum ProposalActivateOutput: Codable {
    case ok(proposalId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, proposalId, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let proposalId):
            try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct ProposalAdvanceInput: Codable {
    public let proposalId: String
    public let nextStage: String
    public init(proposalId: String, nextStage: String) { self.proposalId = proposalId; self.nextStage = nextStage }
}

public enum ProposalAdvanceOutput: Codable {
    case ok(proposalId: String, stage: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, proposalId, stage, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId), stage: try c.decode(String.self, forKey: .stage))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let proposalId, let stage):
            try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId); try c.encode(stage, forKey: .stage)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct ProposalCancelInput: Codable {
    public let proposalId: String
    public let reason: String
    public init(proposalId: String, reason: String) { self.proposalId = proposalId; self.reason = reason }
}

public enum ProposalCancelOutput: Codable {
    case ok(proposalId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, proposalId, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let proposalId):
            try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

// MARK: - Vote Types

public struct VoteOpenSessionInput: Codable {
    public let proposalId: String
    public let method: String
    public let deadline: String
    public init(proposalId: String, method: String, deadline: String) { self.proposalId = proposalId; self.method = method; self.deadline = deadline }
}

public enum VoteOpenSessionOutput: Codable {
    case ok(sessionId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, sessionId, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(sessionId: try c.decode(String.self, forKey: .sessionId))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sessionId):
            try c.encode("ok", forKey: .variant); try c.encode(sessionId, forKey: .sessionId)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct VoteCastVoteInput: Codable {
    public let sessionId: String
    public let voterId: String
    public let choice: String
    public let weight: String
    public init(sessionId: String, voterId: String, choice: String, weight: String) { self.sessionId = sessionId; self.voterId = voterId; self.choice = choice; self.weight = weight }
}

public enum VoteCastVoteOutput: Codable {
    case ok(sessionId: String, voterId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, sessionId, voterId, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(sessionId: try c.decode(String.self, forKey: .sessionId), voterId: try c.decode(String.self, forKey: .voterId))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sessionId, let voterId):
            try c.encode("ok", forKey: .variant); try c.encode(sessionId, forKey: .sessionId); try c.encode(voterId, forKey: .voterId)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct VoteCloseInput: Codable {
    public let sessionId: String
    public init(sessionId: String) { self.sessionId = sessionId }
}

public enum VoteCloseOutput: Codable {
    case ok(sessionId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, sessionId, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(sessionId: try c.decode(String.self, forKey: .sessionId))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sessionId):
            try c.encode("ok", forKey: .variant); try c.encode(sessionId, forKey: .sessionId)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct VoteTallyInput: Codable {
    public let sessionId: String
    public init(sessionId: String) { self.sessionId = sessionId }
}

public enum VoteTallyOutput: Codable {
    case ok(sessionId: String, result: String, totalVotes: Int)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, sessionId, result, totalVotes, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(sessionId: try c.decode(String.self, forKey: .sessionId), result: try c.decode(String.self, forKey: .result), totalVotes: try c.decode(Int.self, forKey: .totalVotes))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sessionId, let result, let totalVotes):
            try c.encode("ok", forKey: .variant); try c.encode(sessionId, forKey: .sessionId); try c.encode(result, forKey: .result); try c.encode(totalVotes, forKey: .totalVotes)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

// MARK: - CountingMethod Types

public struct CountingMethodRegisterInput: Codable {
    public let name: String
    public let config: String
    public init(name: String, config: String) { self.name = name; self.config = config }
}

public enum CountingMethodRegisterOutput: Codable {
    case ok(methodId: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, methodId, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(methodId: try c.decode(String.self, forKey: .methodId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let methodId): try c.encode("ok", forKey: .variant); try c.encode(methodId, forKey: .methodId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct CountingMethodAggregateInput: Codable {
    public let methodId: String
    public let votes: String
    public init(methodId: String, votes: String) { self.methodId = methodId; self.votes = votes }
}

public enum CountingMethodAggregateOutput: Codable {
    case ok(result: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, result, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(result: try c.decode(String.self, forKey: .result)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let result): try c.encode("ok", forKey: .variant); try c.encode(result, forKey: .result); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct CountingMethodDeregisterInput: Codable {
    public let methodId: String
    public init(methodId: String) { self.methodId = methodId }
}

public enum CountingMethodDeregisterOutput: Codable {
    case ok(methodId: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, methodId, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(methodId: try c.decode(String.self, forKey: .methodId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let methodId): try c.encode("ok", forKey: .variant); try c.encode(methodId, forKey: .methodId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - Quorum Types

public struct QuorumSetThresholdInput: Codable {
    public let polityId: String
    public let threshold: String
    public init(polityId: String, threshold: String) { self.polityId = polityId; self.threshold = threshold }
}

public enum QuorumSetThresholdOutput: Codable {
    case ok(polityId: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, polityId, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(polityId: try c.decode(String.self, forKey: .polityId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let polityId): try c.encode("ok", forKey: .variant); try c.encode(polityId, forKey: .polityId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct QuorumCheckInput: Codable {
    public let sessionId: String
    public init(sessionId: String) { self.sessionId = sessionId }
}

public enum QuorumCheckOutput: Codable {
    case ok(sessionId: String, met: Bool, participation: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, sessionId, met, participation, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(sessionId: try c.decode(String.self, forKey: .sessionId), met: try c.decode(Bool.self, forKey: .met), participation: try c.decode(String.self, forKey: .participation)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let sessionId, let met, let participation): try c.encode("ok", forKey: .variant); try c.encode(sessionId, forKey: .sessionId); try c.encode(met, forKey: .met); try c.encode(participation, forKey: .participation); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct QuorumUpdateThresholdInput: Codable {
    public let polityId: String
    public let newThreshold: String
    public init(polityId: String, newThreshold: String) { self.polityId = polityId; self.newThreshold = newThreshold }
}

public enum QuorumUpdateThresholdOutput: Codable {
    case ok(polityId: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, polityId, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(polityId: try c.decode(String.self, forKey: .polityId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let polityId): try c.encode("ok", forKey: .variant); try c.encode(polityId, forKey: .polityId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - Conviction Types

public struct ConvictionRegisterProposalInput: Codable { public let proposalId: String; public init(proposalId: String) { self.proposalId = proposalId } }
public enum ConvictionRegisterProposalOutput: Codable { case ok(proposalId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, proposalId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let proposalId): try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ConvictionStakeInput: Codable { public let proposalId: String; public let memberId: String; public let amount: String; public init(proposalId: String, memberId: String, amount: String) { self.proposalId = proposalId; self.memberId = memberId; self.amount = amount } }
public enum ConvictionStakeOutput: Codable { case ok(proposalId: String, memberId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, proposalId, memberId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId), memberId: try c.decode(String.self, forKey: .memberId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let proposalId, let memberId): try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId); try c.encode(memberId, forKey: .memberId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ConvictionUnstakeInput: Codable { public let proposalId: String; public let memberId: String; public init(proposalId: String, memberId: String) { self.proposalId = proposalId; self.memberId = memberId } }
public enum ConvictionUnstakeOutput: Codable { case ok(proposalId: String, memberId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, proposalId, memberId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId), memberId: try c.decode(String.self, forKey: .memberId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let proposalId, let memberId): try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId); try c.encode(memberId, forKey: .memberId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ConvictionUpdateConvictionInput: Codable { public let proposalId: String; public init(proposalId: String) { self.proposalId = proposalId } }
public enum ConvictionUpdateConvictionOutput: Codable { case ok(proposalId: String, conviction: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, proposalId, conviction, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(proposalId: try c.decode(String.self, forKey: .proposalId), conviction: try c.decode(String.self, forKey: .conviction)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let proposalId, let conviction): try c.encode("ok", forKey: .variant); try c.encode(proposalId, forKey: .proposalId); try c.encode(conviction, forKey: .conviction); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - PredictionMarket Types

public struct PredictionMarketCreateMarketInput: Codable { public let question: String; public let outcomes: String; public let deadline: String; public init(question: String, outcomes: String, deadline: String) { self.question = question; self.outcomes = outcomes; self.deadline = deadline } }
public enum PredictionMarketCreateMarketOutput: Codable { case ok(marketId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, marketId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(marketId: try c.decode(String.self, forKey: .marketId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let marketId): try c.encode("ok", forKey: .variant); try c.encode(marketId, forKey: .marketId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct PredictionMarketTradeInput: Codable { public let marketId: String; public let traderId: String; public let outcome: String; public let amount: String; public init(marketId: String, traderId: String, outcome: String, amount: String) { self.marketId = marketId; self.traderId = traderId; self.outcome = outcome; self.amount = amount } }
public enum PredictionMarketTradeOutput: Codable { case ok(marketId: String, shares: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, marketId, shares, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(marketId: try c.decode(String.self, forKey: .marketId), shares: try c.decode(String.self, forKey: .shares)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let marketId, let shares): try c.encode("ok", forKey: .variant); try c.encode(marketId, forKey: .marketId); try c.encode(shares, forKey: .shares); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct PredictionMarketResolveInput: Codable { public let marketId: String; public let outcome: String; public init(marketId: String, outcome: String) { self.marketId = marketId; self.outcome = outcome } }
public enum PredictionMarketResolveOutput: Codable { case ok(marketId: String, outcome: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, marketId, outcome, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(marketId: try c.decode(String.self, forKey: .marketId), outcome: try c.decode(String.self, forKey: .outcome)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let marketId, let outcome): try c.encode("ok", forKey: .variant); try c.encode(marketId, forKey: .marketId); try c.encode(outcome, forKey: .outcome); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct PredictionMarketClaimPayoutInput: Codable { public let marketId: String; public let traderId: String; public init(marketId: String, traderId: String) { self.marketId = marketId; self.traderId = traderId } }
public enum PredictionMarketClaimPayoutOutput: Codable { case ok(marketId: String, payout: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, marketId, payout, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(marketId: try c.decode(String.self, forKey: .marketId), payout: try c.decode(String.self, forKey: .payout)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let marketId, let payout): try c.encode("ok", forKey: .variant); try c.encode(marketId, forKey: .marketId); try c.encode(payout, forKey: .payout); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - OptimisticApproval Types

public struct OptimisticApprovalAssertInput: Codable { public let proposalId: String; public let asserterId: String; public let bond: String; public init(proposalId: String, asserterId: String, bond: String) { self.proposalId = proposalId; self.asserterId = asserterId; self.bond = bond } }
public enum OptimisticApprovalAssertOutput: Codable { case ok(assertionId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, assertionId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(assertionId: try c.decode(String.self, forKey: .assertionId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let assertionId): try c.encode("ok", forKey: .variant); try c.encode(assertionId, forKey: .assertionId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct OptimisticApprovalChallengeInput: Codable { public let assertionId: String; public let challengerId: String; public let evidence: String; public init(assertionId: String, challengerId: String, evidence: String) { self.assertionId = assertionId; self.challengerId = challengerId; self.evidence = evidence } }
public enum OptimisticApprovalChallengeOutput: Codable { case ok(challengeId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, challengeId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(challengeId: try c.decode(String.self, forKey: .challengeId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let challengeId): try c.encode("ok", forKey: .variant); try c.encode(challengeId, forKey: .challengeId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct OptimisticApprovalFinalizeInput: Codable { public let assertionId: String; public init(assertionId: String) { self.assertionId = assertionId } }
public enum OptimisticApprovalFinalizeOutput: Codable { case ok(assertionId: String, accepted: Bool); case error(message: String); enum CodingKeys: String, CodingKey { case variant, assertionId, accepted, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(assertionId: try c.decode(String.self, forKey: .assertionId), accepted: try c.decode(Bool.self, forKey: .accepted)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let assertionId, let accepted): try c.encode("ok", forKey: .variant); try c.encode(assertionId, forKey: .assertionId); try c.encode(accepted, forKey: .accepted); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct OptimisticApprovalResolveInput: Codable { public let challengeId: String; public let ruling: String; public init(challengeId: String, ruling: String) { self.challengeId = challengeId; self.ruling = ruling } }
public enum OptimisticApprovalResolveOutput: Codable { case ok(challengeId: String, ruling: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, challengeId, ruling, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(challengeId: try c.decode(String.self, forKey: .challengeId), ruling: try c.decode(String.self, forKey: .ruling)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let challengeId, let ruling): try c.encode("ok", forKey: .variant); try c.encode(challengeId, forKey: .challengeId); try c.encode(ruling, forKey: .ruling); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Deliberation Types

public struct DeliberationOpenInput: Codable { public let proposalId: String; public let topic: String; public init(proposalId: String, topic: String) { self.proposalId = proposalId; self.topic = topic } }
public enum DeliberationOpenOutput: Codable { case ok(deliberationId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, deliberationId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(deliberationId: try c.decode(String.self, forKey: .deliberationId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let deliberationId): try c.encode("ok", forKey: .variant); try c.encode(deliberationId, forKey: .deliberationId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct DeliberationAddEntryInput: Codable { public let deliberationId: String; public let authorId: String; public let content: String; public init(deliberationId: String, authorId: String, content: String) { self.deliberationId = deliberationId; self.authorId = authorId; self.content = content } }
public enum DeliberationAddEntryOutput: Codable { case ok(entryId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, entryId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(entryId: try c.decode(String.self, forKey: .entryId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let entryId): try c.encode("ok", forKey: .variant); try c.encode(entryId, forKey: .entryId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct DeliberationSignalInput: Codable { public let deliberationId: String; public let memberId: String; public let signal: String; public init(deliberationId: String, memberId: String, signal: String) { self.deliberationId = deliberationId; self.memberId = memberId; self.signal = signal } }
public enum DeliberationSignalOutput: Codable { case ok(deliberationId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, deliberationId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(deliberationId: try c.decode(String.self, forKey: .deliberationId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let deliberationId): try c.encode("ok", forKey: .variant); try c.encode(deliberationId, forKey: .deliberationId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct DeliberationCloseInput: Codable { public let deliberationId: String; public let summary: String; public init(deliberationId: String, summary: String) { self.deliberationId = deliberationId; self.summary = summary } }
public enum DeliberationCloseOutput: Codable { case ok(deliberationId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, deliberationId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(deliberationId: try c.decode(String.self, forKey: .deliberationId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let deliberationId): try c.encode("ok", forKey: .variant); try c.encode(deliberationId, forKey: .deliberationId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Meeting Types

public struct MeetingScheduleInput: Codable { public let polityId: String; public let title: String; public let scheduledAt: String; public init(polityId: String, title: String, scheduledAt: String) { self.polityId = polityId; self.title = title; self.scheduledAt = scheduledAt } }
public enum MeetingScheduleOutput: Codable { case ok(meetingId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, meetingId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(meetingId: try c.decode(String.self, forKey: .meetingId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let meetingId): try c.encode("ok", forKey: .variant); try c.encode(meetingId, forKey: .meetingId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MeetingCallToOrderInput: Codable { public let meetingId: String; public let chairId: String; public init(meetingId: String, chairId: String) { self.meetingId = meetingId; self.chairId = chairId } }
public enum MeetingCallToOrderOutput: Codable { case ok(meetingId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, meetingId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(meetingId: try c.decode(String.self, forKey: .meetingId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let meetingId): try c.encode("ok", forKey: .variant); try c.encode(meetingId, forKey: .meetingId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MeetingMakeMotionInput: Codable { public let meetingId: String; public let moverId: String; public let motion: String; public init(meetingId: String, moverId: String, motion: String) { self.meetingId = meetingId; self.moverId = moverId; self.motion = motion } }
public enum MeetingMakeMotionOutput: Codable { case ok(motionId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, motionId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(motionId: try c.decode(String.self, forKey: .motionId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let motionId): try c.encode("ok", forKey: .variant); try c.encode(motionId, forKey: .motionId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MeetingSecondMotionInput: Codable { public let motionId: String; public let seconderId: String; public init(motionId: String, seconderId: String) { self.motionId = motionId; self.seconderId = seconderId } }
public enum MeetingSecondMotionOutput: Codable { case ok(motionId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, motionId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(motionId: try c.decode(String.self, forKey: .motionId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let motionId): try c.encode("ok", forKey: .variant); try c.encode(motionId, forKey: .motionId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MeetingCallQuestionInput: Codable { public let motionId: String; public init(motionId: String) { self.motionId = motionId } }
public enum MeetingCallQuestionOutput: Codable { case ok(motionId: String, result: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, motionId, result, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(motionId: try c.decode(String.self, forKey: .motionId), result: try c.decode(String.self, forKey: .result)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let motionId, let result): try c.encode("ok", forKey: .variant); try c.encode(motionId, forKey: .motionId); try c.encode(result, forKey: .result); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MeetingRecordMinuteInput: Codable { public let meetingId: String; public let content: String; public init(meetingId: String, content: String) { self.meetingId = meetingId; self.content = content } }
public enum MeetingRecordMinuteOutput: Codable { case ok(minuteId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, minuteId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(minuteId: try c.decode(String.self, forKey: .minuteId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let minuteId): try c.encode("ok", forKey: .variant); try c.encode(minuteId, forKey: .minuteId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MeetingAdjournInput: Codable { public let meetingId: String; public init(meetingId: String) { self.meetingId = meetingId } }
public enum MeetingAdjournOutput: Codable { case ok(meetingId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, meetingId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(meetingId: try c.decode(String.self, forKey: .meetingId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let meetingId): try c.encode("ok", forKey: .variant); try c.encode(meetingId, forKey: .meetingId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Handler Protocols

public protocol ProposalHandler {
    func create(input: ProposalCreateInput, storage: ConceptStorage) async throws -> ProposalCreateOutput
    func sponsor(input: ProposalSponsorInput, storage: ConceptStorage) async throws -> ProposalSponsorOutput
    func activate(input: ProposalActivateInput, storage: ConceptStorage) async throws -> ProposalActivateOutput
    func advance(input: ProposalAdvanceInput, storage: ConceptStorage) async throws -> ProposalAdvanceOutput
    func cancel(input: ProposalCancelInput, storage: ConceptStorage) async throws -> ProposalCancelOutput
}

public protocol VoteHandler {
    func openSession(input: VoteOpenSessionInput, storage: ConceptStorage) async throws -> VoteOpenSessionOutput
    func castVote(input: VoteCastVoteInput, storage: ConceptStorage) async throws -> VoteCastVoteOutput
    func close(input: VoteCloseInput, storage: ConceptStorage) async throws -> VoteCloseOutput
    func tally(input: VoteTallyInput, storage: ConceptStorage) async throws -> VoteTallyOutput
}

public protocol CountingMethodHandler {
    func register(input: CountingMethodRegisterInput, storage: ConceptStorage) async throws -> CountingMethodRegisterOutput
    func aggregate(input: CountingMethodAggregateInput, storage: ConceptStorage) async throws -> CountingMethodAggregateOutput
    func deregister(input: CountingMethodDeregisterInput, storage: ConceptStorage) async throws -> CountingMethodDeregisterOutput
}

public protocol QuorumHandler {
    func setThreshold(input: QuorumSetThresholdInput, storage: ConceptStorage) async throws -> QuorumSetThresholdOutput
    func check(input: QuorumCheckInput, storage: ConceptStorage) async throws -> QuorumCheckOutput
    func updateThreshold(input: QuorumUpdateThresholdInput, storage: ConceptStorage) async throws -> QuorumUpdateThresholdOutput
}

public protocol ConvictionHandler {
    func registerProposal(input: ConvictionRegisterProposalInput, storage: ConceptStorage) async throws -> ConvictionRegisterProposalOutput
    func stake(input: ConvictionStakeInput, storage: ConceptStorage) async throws -> ConvictionStakeOutput
    func unstake(input: ConvictionUnstakeInput, storage: ConceptStorage) async throws -> ConvictionUnstakeOutput
    func updateConviction(input: ConvictionUpdateConvictionInput, storage: ConceptStorage) async throws -> ConvictionUpdateConvictionOutput
}

public protocol PredictionMarketHandler {
    func createMarket(input: PredictionMarketCreateMarketInput, storage: ConceptStorage) async throws -> PredictionMarketCreateMarketOutput
    func trade(input: PredictionMarketTradeInput, storage: ConceptStorage) async throws -> PredictionMarketTradeOutput
    func resolve(input: PredictionMarketResolveInput, storage: ConceptStorage) async throws -> PredictionMarketResolveOutput
    func claimPayout(input: PredictionMarketClaimPayoutInput, storage: ConceptStorage) async throws -> PredictionMarketClaimPayoutOutput
}

public protocol OptimisticApprovalHandler {
    func assert(input: OptimisticApprovalAssertInput, storage: ConceptStorage) async throws -> OptimisticApprovalAssertOutput
    func challenge(input: OptimisticApprovalChallengeInput, storage: ConceptStorage) async throws -> OptimisticApprovalChallengeOutput
    func finalize(input: OptimisticApprovalFinalizeInput, storage: ConceptStorage) async throws -> OptimisticApprovalFinalizeOutput
    func resolve(input: OptimisticApprovalResolveInput, storage: ConceptStorage) async throws -> OptimisticApprovalResolveOutput
}

public protocol DeliberationHandler {
    func open(input: DeliberationOpenInput, storage: ConceptStorage) async throws -> DeliberationOpenOutput
    func addEntry(input: DeliberationAddEntryInput, storage: ConceptStorage) async throws -> DeliberationAddEntryOutput
    func signal(input: DeliberationSignalInput, storage: ConceptStorage) async throws -> DeliberationSignalOutput
    func close(input: DeliberationCloseInput, storage: ConceptStorage) async throws -> DeliberationCloseOutput
}

public protocol MeetingHandler {
    func schedule(input: MeetingScheduleInput, storage: ConceptStorage) async throws -> MeetingScheduleOutput
    func callToOrder(input: MeetingCallToOrderInput, storage: ConceptStorage) async throws -> MeetingCallToOrderOutput
    func makeMotion(input: MeetingMakeMotionInput, storage: ConceptStorage) async throws -> MeetingMakeMotionOutput
    func secondMotion(input: MeetingSecondMotionInput, storage: ConceptStorage) async throws -> MeetingSecondMotionOutput
    func callQuestion(input: MeetingCallQuestionInput, storage: ConceptStorage) async throws -> MeetingCallQuestionOutput
    func recordMinute(input: MeetingRecordMinuteInput, storage: ConceptStorage) async throws -> MeetingRecordMinuteOutput
    func adjourn(input: MeetingAdjournInput, storage: ConceptStorage) async throws -> MeetingAdjournOutput
}

// MARK: - Stub Implementations

public struct ProposalHandlerImpl: ProposalHandler {
    public init() {}
    public func create(input: ProposalCreateInput, storage: ConceptStorage) async throws -> ProposalCreateOutput { /* TODO: implement handler */ return .ok(proposalId: "prop-stub") }
    public func sponsor(input: ProposalSponsorInput, storage: ConceptStorage) async throws -> ProposalSponsorOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId, sponsorId: input.sponsorId) }
    public func activate(input: ProposalActivateInput, storage: ConceptStorage) async throws -> ProposalActivateOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId) }
    public func advance(input: ProposalAdvanceInput, storage: ConceptStorage) async throws -> ProposalAdvanceOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId, stage: input.nextStage) }
    public func cancel(input: ProposalCancelInput, storage: ConceptStorage) async throws -> ProposalCancelOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId) }
}

public struct VoteHandlerImpl: VoteHandler {
    public init() {}
    public func openSession(input: VoteOpenSessionInput, storage: ConceptStorage) async throws -> VoteOpenSessionOutput { /* TODO: implement handler */ return .ok(sessionId: "session-stub") }
    public func castVote(input: VoteCastVoteInput, storage: ConceptStorage) async throws -> VoteCastVoteOutput { /* TODO: implement handler */ return .ok(sessionId: input.sessionId, voterId: input.voterId) }
    public func close(input: VoteCloseInput, storage: ConceptStorage) async throws -> VoteCloseOutput { /* TODO: implement handler */ return .ok(sessionId: input.sessionId) }
    public func tally(input: VoteTallyInput, storage: ConceptStorage) async throws -> VoteTallyOutput { /* TODO: implement handler */ return .ok(sessionId: input.sessionId, result: "pending", totalVotes: 0) }
}

public struct CountingMethodHandlerImpl: CountingMethodHandler {
    public init() {}
    public func register(input: CountingMethodRegisterInput, storage: ConceptStorage) async throws -> CountingMethodRegisterOutput { /* TODO: implement handler */ return .ok(methodId: "method-stub") }
    public func aggregate(input: CountingMethodAggregateInput, storage: ConceptStorage) async throws -> CountingMethodAggregateOutput { /* TODO: implement handler */ return .ok(result: "pending") }
    public func deregister(input: CountingMethodDeregisterInput, storage: ConceptStorage) async throws -> CountingMethodDeregisterOutput { /* TODO: implement handler */ return .ok(methodId: input.methodId) }
}

public struct QuorumHandlerImpl: QuorumHandler {
    public init() {}
    public func setThreshold(input: QuorumSetThresholdInput, storage: ConceptStorage) async throws -> QuorumSetThresholdOutput { /* TODO: implement handler */ return .ok(polityId: input.polityId) }
    public func check(input: QuorumCheckInput, storage: ConceptStorage) async throws -> QuorumCheckOutput { /* TODO: implement handler */ return .ok(sessionId: input.sessionId, met: false, participation: "0") }
    public func updateThreshold(input: QuorumUpdateThresholdInput, storage: ConceptStorage) async throws -> QuorumUpdateThresholdOutput { /* TODO: implement handler */ return .ok(polityId: input.polityId) }
}

public struct ConvictionHandlerImpl: ConvictionHandler {
    public init() {}
    public func registerProposal(input: ConvictionRegisterProposalInput, storage: ConceptStorage) async throws -> ConvictionRegisterProposalOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId) }
    public func stake(input: ConvictionStakeInput, storage: ConceptStorage) async throws -> ConvictionStakeOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId, memberId: input.memberId) }
    public func unstake(input: ConvictionUnstakeInput, storage: ConceptStorage) async throws -> ConvictionUnstakeOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId, memberId: input.memberId) }
    public func updateConviction(input: ConvictionUpdateConvictionInput, storage: ConceptStorage) async throws -> ConvictionUpdateConvictionOutput { /* TODO: implement handler */ return .ok(proposalId: input.proposalId, conviction: "0") }
}

public struct PredictionMarketHandlerImpl: PredictionMarketHandler {
    public init() {}
    public func createMarket(input: PredictionMarketCreateMarketInput, storage: ConceptStorage) async throws -> PredictionMarketCreateMarketOutput { /* TODO: implement handler */ return .ok(marketId: "market-stub") }
    public func trade(input: PredictionMarketTradeInput, storage: ConceptStorage) async throws -> PredictionMarketTradeOutput { /* TODO: implement handler */ return .ok(marketId: input.marketId, shares: "0") }
    public func resolve(input: PredictionMarketResolveInput, storage: ConceptStorage) async throws -> PredictionMarketResolveOutput { /* TODO: implement handler */ return .ok(marketId: input.marketId, outcome: input.outcome) }
    public func claimPayout(input: PredictionMarketClaimPayoutInput, storage: ConceptStorage) async throws -> PredictionMarketClaimPayoutOutput { /* TODO: implement handler */ return .ok(marketId: input.marketId, payout: "0") }
}

public struct OptimisticApprovalHandlerImpl: OptimisticApprovalHandler {
    public init() {}
    public func assert(input: OptimisticApprovalAssertInput, storage: ConceptStorage) async throws -> OptimisticApprovalAssertOutput { /* TODO: implement handler */ return .ok(assertionId: "assert-stub") }
    public func challenge(input: OptimisticApprovalChallengeInput, storage: ConceptStorage) async throws -> OptimisticApprovalChallengeOutput { /* TODO: implement handler */ return .ok(challengeId: "challenge-stub") }
    public func finalize(input: OptimisticApprovalFinalizeInput, storage: ConceptStorage) async throws -> OptimisticApprovalFinalizeOutput { /* TODO: implement handler */ return .ok(assertionId: input.assertionId, accepted: false) }
    public func resolve(input: OptimisticApprovalResolveInput, storage: ConceptStorage) async throws -> OptimisticApprovalResolveOutput { /* TODO: implement handler */ return .ok(challengeId: input.challengeId, ruling: input.ruling) }
}

public struct DeliberationHandlerImpl: DeliberationHandler {
    public init() {}
    public func open(input: DeliberationOpenInput, storage: ConceptStorage) async throws -> DeliberationOpenOutput { /* TODO: implement handler */ return .ok(deliberationId: "delib-stub") }
    public func addEntry(input: DeliberationAddEntryInput, storage: ConceptStorage) async throws -> DeliberationAddEntryOutput { /* TODO: implement handler */ return .ok(entryId: "entry-stub") }
    public func signal(input: DeliberationSignalInput, storage: ConceptStorage) async throws -> DeliberationSignalOutput { /* TODO: implement handler */ return .ok(deliberationId: input.deliberationId) }
    public func close(input: DeliberationCloseInput, storage: ConceptStorage) async throws -> DeliberationCloseOutput { /* TODO: implement handler */ return .ok(deliberationId: input.deliberationId) }
}

public struct MeetingHandlerImpl: MeetingHandler {
    public init() {}
    public func schedule(input: MeetingScheduleInput, storage: ConceptStorage) async throws -> MeetingScheduleOutput { /* TODO: implement handler */ return .ok(meetingId: "meeting-stub") }
    public func callToOrder(input: MeetingCallToOrderInput, storage: ConceptStorage) async throws -> MeetingCallToOrderOutput { /* TODO: implement handler */ return .ok(meetingId: input.meetingId) }
    public func makeMotion(input: MeetingMakeMotionInput, storage: ConceptStorage) async throws -> MeetingMakeMotionOutput { /* TODO: implement handler */ return .ok(motionId: "motion-stub") }
    public func secondMotion(input: MeetingSecondMotionInput, storage: ConceptStorage) async throws -> MeetingSecondMotionOutput { /* TODO: implement handler */ return .ok(motionId: input.motionId) }
    public func callQuestion(input: MeetingCallQuestionInput, storage: ConceptStorage) async throws -> MeetingCallQuestionOutput { /* TODO: implement handler */ return .ok(motionId: input.motionId, result: "pending") }
    public func recordMinute(input: MeetingRecordMinuteInput, storage: ConceptStorage) async throws -> MeetingRecordMinuteOutput { /* TODO: implement handler */ return .ok(minuteId: "minute-stub") }
    public func adjourn(input: MeetingAdjournInput, storage: ConceptStorage) async throws -> MeetingAdjournOutput { /* TODO: implement handler */ return .ok(meetingId: input.meetingId) }
}
