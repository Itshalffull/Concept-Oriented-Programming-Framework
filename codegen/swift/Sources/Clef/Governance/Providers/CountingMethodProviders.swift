// CountingMethodProviders.swift — Governance Counting Method providers: Majority, Supermajority, ApprovalCounting, ScoreVoting, BordaCount, RankedChoice, QuadraticVoting, CondorcetSchulze, ConsentProcess

import Foundation

// MARK: - Shared Ballot Types

public struct WeightedBallot: Codable {
    public let voter: String
    public let choice: String
    public init(voter: String, choice: String) { self.voter = voter; self.choice = choice }
}

public struct RankedBallot: Codable {
    public let voter: String
    public let ranking: [String]
    public init(voter: String, ranking: [String]) { self.voter = voter; self.ranking = ranking }
}

public struct ApprovalBallot: Codable {
    public let voter: String
    public let approvals: [String]
    public init(voter: String, approvals: [String]) { self.voter = voter; self.approvals = approvals }
}

public struct ScoreBallot: Codable {
    public let voter: String
    public let scores: [String: Double]
    public init(voter: String, scores: [String: Double]) { self.voter = voter; self.scores = scores }
}

// MARK: - Majority Types

public struct MajorityConfigureInput: Codable {
    public let threshold: Double?
    public let binaryOnly: Bool?
    public let tieBreaker: String?
    public init(threshold: Double? = nil, binaryOnly: Bool? = nil, tieBreaker: String? = nil) { self.threshold = threshold; self.binaryOnly = binaryOnly; self.tieBreaker = tieBreaker }
}

public enum MajorityConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct MajorityCountInput: Codable {
    public let config: String
    public let ballots: [WeightedBallot]
    public let weights: [String: Double]?
    public init(config: String, ballots: [WeightedBallot], weights: [String: Double]? = nil) { self.config = config; self.ballots = ballots; self.weights = weights }
}

public enum MajorityCountOutput: Codable {
    case winner(choice: String, voteShare: Double, totalWeight: Double)
    case tie(choices: String, totalWeight: Double)
    case noMajority(topChoice: String, voteShare: Double, threshold: Double, totalWeight: Double)
    case noVotes(totalWeight: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, choice, choices, voteShare, totalWeight, topChoice, threshold, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "winner": self = .winner(choice: try c.decode(String.self, forKey: .choice), voteShare: try c.decode(Double.self, forKey: .voteShare), totalWeight: try c.decode(Double.self, forKey: .totalWeight)); case "tie": self = .tie(choices: try c.decode(String.self, forKey: .choices), totalWeight: try c.decode(Double.self, forKey: .totalWeight)); case "no_majority": self = .noMajority(topChoice: try c.decode(String.self, forKey: .topChoice), voteShare: try c.decode(Double.self, forKey: .voteShare), threshold: try c.decode(Double.self, forKey: .threshold), totalWeight: try c.decode(Double.self, forKey: .totalWeight)); case "no_votes": self = .noVotes(totalWeight: try c.decode(Double.self, forKey: .totalWeight)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .winner(let choice, let voteShare, let totalWeight): try c.encode("winner", forKey: .variant); try c.encode(choice, forKey: .choice); try c.encode(voteShare, forKey: .voteShare); try c.encode(totalWeight, forKey: .totalWeight); case .tie(let choices, let totalWeight): try c.encode("tie", forKey: .variant); try c.encode(choices, forKey: .choices); try c.encode(totalWeight, forKey: .totalWeight); case .noMajority(let topChoice, let voteShare, let threshold, let totalWeight): try c.encode("no_majority", forKey: .variant); try c.encode(topChoice, forKey: .topChoice); try c.encode(voteShare, forKey: .voteShare); try c.encode(threshold, forKey: .threshold); try c.encode(totalWeight, forKey: .totalWeight); case .noVotes(let totalWeight): try c.encode("no_votes", forKey: .variant); try c.encode(totalWeight, forKey: .totalWeight); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - Supermajority Types

public struct SupermajorityConfigureInput: Codable {
    public let threshold: Double?
    public let roundingMode: String?
    public let abstentionsCount: Bool?
    public init(threshold: Double? = nil, roundingMode: String? = nil, abstentionsCount: Bool? = nil) { self.threshold = threshold; self.roundingMode = roundingMode; self.abstentionsCount = abstentionsCount }
}

public enum SupermajorityConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct SupermajorityCountInput: Codable {
    public let config: String
    public let ballots: [WeightedBallot]
    public let weights: [String: Double]?
    public init(config: String, ballots: [WeightedBallot], weights: [String: Double]? = nil) { self.config = config; self.ballots = ballots; self.weights = weights }
}

public enum SupermajorityCountOutput: Codable {
    case winner(choice: String, voteShare: Double, requiredShare: Double, totalWeight: Double, abstentions: Double)
    case noSupermajority(topChoice: String, voteShare: Double, requiredShare: Double, totalWeight: Double, abstentions: Double)
    case noVotes(totalWeight: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, choice, topChoice, voteShare, requiredShare, totalWeight, abstentions, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "winner": self = .winner(choice: try c.decode(String.self, forKey: .choice), voteShare: try c.decode(Double.self, forKey: .voteShare), requiredShare: try c.decode(Double.self, forKey: .requiredShare), totalWeight: try c.decode(Double.self, forKey: .totalWeight), abstentions: try c.decode(Double.self, forKey: .abstentions)); case "no_supermajority": self = .noSupermajority(topChoice: try c.decode(String.self, forKey: .topChoice), voteShare: try c.decode(Double.self, forKey: .voteShare), requiredShare: try c.decode(Double.self, forKey: .requiredShare), totalWeight: try c.decode(Double.self, forKey: .totalWeight), abstentions: try c.decode(Double.self, forKey: .abstentions)); case "no_votes": self = .noVotes(totalWeight: try c.decode(Double.self, forKey: .totalWeight)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .winner(let choice, let voteShare, let requiredShare, let totalWeight, let abstentions): try c.encode("winner", forKey: .variant); try c.encode(choice, forKey: .choice); try c.encode(voteShare, forKey: .voteShare); try c.encode(requiredShare, forKey: .requiredShare); try c.encode(totalWeight, forKey: .totalWeight); try c.encode(abstentions, forKey: .abstentions); case .noSupermajority(let topChoice, let voteShare, let requiredShare, let totalWeight, let abstentions): try c.encode("no_supermajority", forKey: .variant); try c.encode(topChoice, forKey: .topChoice); try c.encode(voteShare, forKey: .voteShare); try c.encode(requiredShare, forKey: .requiredShare); try c.encode(totalWeight, forKey: .totalWeight); try c.encode(abstentions, forKey: .abstentions); case .noVotes(let totalWeight): try c.encode("no_votes", forKey: .variant); try c.encode(totalWeight, forKey: .totalWeight); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - ApprovalCounting Types

public struct ApprovalCountingConfigureInput: Codable {
    public let maxApprovals: Int?
    public let winnerCount: Int?
    public init(maxApprovals: Int? = nil, winnerCount: Int? = nil) { self.maxApprovals = maxApprovals; self.winnerCount = winnerCount }
}

public enum ApprovalCountingConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ApprovalCountingCountInput: Codable {
    public let config: String
    public let ballots: [ApprovalBallot]
    public let weights: [String: Double]?
    public init(config: String, ballots: [ApprovalBallot], weights: [String: Double]? = nil) { self.config = config; self.ballots = ballots; self.weights = weights }
}

public enum ApprovalCountingCountOutput: Codable {
    case winners(rankedResults: String, topChoice: String?, approvalCount: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, rankedResults, topChoice, approvalCount, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "winners": self = .winners(rankedResults: try c.decode(String.self, forKey: .rankedResults), topChoice: try c.decodeIfPresent(String.self, forKey: .topChoice), approvalCount: try c.decode(Double.self, forKey: .approvalCount)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .winners(let rankedResults, let topChoice, let approvalCount): try c.encode("winners", forKey: .variant); try c.encode(rankedResults, forKey: .rankedResults); try c.encode(topChoice, forKey: .topChoice); try c.encode(approvalCount, forKey: .approvalCount); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - ScoreVoting Types

public struct ScoreVotingConfigureInput: Codable {
    public let minScore: Double?
    public let maxScore: Double?
    public let aggregation: String?
    public init(minScore: Double? = nil, maxScore: Double? = nil, aggregation: String? = nil) { self.minScore = minScore; self.maxScore = maxScore; self.aggregation = aggregation }
}

public enum ScoreVotingConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ScoreVotingCountInput: Codable {
    public let config: String
    public let ballots: [ScoreBallot]
    public let weights: [String: Double]?
    public init(config: String, ballots: [ScoreBallot], weights: [String: Double]? = nil) { self.config = config; self.ballots = ballots; self.weights = weights }
}

public enum ScoreVotingCountOutput: Codable {
    case winner(choice: String?, averageScore: Double, distribution: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, choice, averageScore, distribution, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "winner": self = .winner(choice: try c.decodeIfPresent(String.self, forKey: .choice), averageScore: try c.decode(Double.self, forKey: .averageScore), distribution: try c.decode(String.self, forKey: .distribution)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .winner(let choice, let averageScore, let distribution): try c.encode("winner", forKey: .variant); try c.encode(choice, forKey: .choice); try c.encode(averageScore, forKey: .averageScore); try c.encode(distribution, forKey: .distribution); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - BordaCount Types

public struct BordaCountConfigureInput: Codable {
    public let scheme: String?
    public let candidates: [String]
    public init(scheme: String? = nil, candidates: [String]) { self.scheme = scheme; self.candidates = candidates }
}

public enum BordaCountConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct BordaCountCountInput: Codable {
    public let config: String
    public let ballots: [RankedBallot]
    public let weights: [String: Double]?
    public init(config: String, ballots: [RankedBallot], weights: [String: Double]? = nil) { self.config = config; self.ballots = ballots; self.weights = weights }
}

public enum BordaCountCountOutput: Codable {
    case winner(choice: String?, scores: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, choice, scores, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "winner": self = .winner(choice: try c.decodeIfPresent(String.self, forKey: .choice), scores: try c.decode(String.self, forKey: .scores)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .winner(let choice, let scores): try c.encode("winner", forKey: .variant); try c.encode(choice, forKey: .choice); try c.encode(scores, forKey: .scores); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - RankedChoice Types

public struct RankedChoiceConfigureInput: Codable {
    public let seats: Int?
    public let method: String?
    public init(seats: Int? = nil, method: String? = nil) { self.seats = seats; self.method = method }
}

public enum RankedChoiceConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct RankedChoiceCountInput: Codable {
    public let config: String
    public let ballots: [RankedBallot]
    public let weights: [String: Double]?
    public init(config: String, ballots: [RankedBallot], weights: [String: Double]? = nil) { self.config = config; self.ballots = ballots; self.weights = weights }
}

public enum RankedChoiceCountOutput: Codable {
    case elected(winners: String, rounds: String)
    case exhausted(rounds: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, winners, rounds, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "elected": self = .elected(winners: try c.decode(String.self, forKey: .winners), rounds: try c.decode(String.self, forKey: .rounds)); case "exhausted": self = .exhausted(rounds: try c.decode(String.self, forKey: .rounds)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .elected(let winners, let rounds): try c.encode("elected", forKey: .variant); try c.encode(winners, forKey: .winners); try c.encode(rounds, forKey: .rounds); case .exhausted(let rounds): try c.encode("exhausted", forKey: .variant); try c.encode(rounds, forKey: .rounds); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - QuadraticVoting Types

public struct QuadraticVotingOpenSessionInput: Codable {
    public let creditBudget: Double
    public let options: [String]
    public init(creditBudget: Double, options: [String]) { self.creditBudget = creditBudget; self.options = options }
}

public enum QuadraticVotingOpenSessionOutput: Codable {
    case opened(session: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, session, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "opened": self = .opened(session: try c.decode(String.self, forKey: .session)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .opened(let session): try c.encode("opened", forKey: .variant); try c.encode(session, forKey: .session); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct QuadraticVotingCastVotesInput: Codable {
    public let session: String
    public let voter: String
    public let allocations: [String: Double]
    public init(session: String, voter: String, allocations: [String: Double]) { self.session = session; self.voter = voter; self.allocations = allocations }
}

public enum QuadraticVotingCastVotesOutput: Codable {
    case cast(session: String, totalCost: Double, remainingCredits: Double)
    case budgetExceeded(totalCost: Double, budget: Double)
    case sessionClosed(session: String)
    case notFound(session: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, session, totalCost, remainingCredits, budget, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "cast": self = .cast(session: try c.decode(String.self, forKey: .session), totalCost: try c.decode(Double.self, forKey: .totalCost), remainingCredits: try c.decode(Double.self, forKey: .remainingCredits)); case "budget_exceeded": self = .budgetExceeded(totalCost: try c.decode(Double.self, forKey: .totalCost), budget: try c.decode(Double.self, forKey: .budget)); case "session_closed": self = .sessionClosed(session: try c.decode(String.self, forKey: .session)); case "not_found": self = .notFound(session: try c.decode(String.self, forKey: .session)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .cast(let session, let totalCost, let remainingCredits): try c.encode("cast", forKey: .variant); try c.encode(session, forKey: .session); try c.encode(totalCost, forKey: .totalCost); try c.encode(remainingCredits, forKey: .remainingCredits); case .budgetExceeded(let totalCost, let budget): try c.encode("budget_exceeded", forKey: .variant); try c.encode(totalCost, forKey: .totalCost); try c.encode(budget, forKey: .budget); case .sessionClosed(let session): try c.encode("session_closed", forKey: .variant); try c.encode(session, forKey: .session); case .notFound(let session): try c.encode("not_found", forKey: .variant); try c.encode(session, forKey: .session); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct QuadraticVotingTallyInput: Codable {
    public let session: String
    public init(session: String) { self.session = session }
}

public enum QuadraticVotingTallyOutput: Codable {
    case result(session: String, winner: String?, votesByOption: String)
    case notFound(session: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, session, winner, votesByOption, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "result": self = .result(session: try c.decode(String.self, forKey: .session), winner: try c.decodeIfPresent(String.self, forKey: .winner), votesByOption: try c.decode(String.self, forKey: .votesByOption)); case "not_found": self = .notFound(session: try c.decode(String.self, forKey: .session)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .result(let session, let winner, let votesByOption): try c.encode("result", forKey: .variant); try c.encode(session, forKey: .session); try c.encode(winner, forKey: .winner); try c.encode(votesByOption, forKey: .votesByOption); case .notFound(let session): try c.encode("not_found", forKey: .variant); try c.encode(session, forKey: .session); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - CondorcetSchulze Types

public struct CondorcetSchulzeConfigureInput: Codable {
    public let tieBreaker: String?
    public init(tieBreaker: String? = nil) { self.tieBreaker = tieBreaker }
}

public enum CondorcetSchulzeConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct CondorcetSchulzeCountInput: Codable {
    public let config: String
    public let ballots: [RankedBallot]
    public let weights: [String: Double]?
    public init(config: String, ballots: [RankedBallot], weights: [String: Double]? = nil) { self.config = config; self.ballots = ballots; self.weights = weights }
}

public enum CondorcetSchulzeCountOutput: Codable {
    case winner(choice: String, pairwiseMatrix: String)
    case noCondorcetWinner(ranking: String, pairwiseMatrix: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, choice, ranking, pairwiseMatrix, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "winner": self = .winner(choice: try c.decode(String.self, forKey: .choice), pairwiseMatrix: try c.decode(String.self, forKey: .pairwiseMatrix)); case "no_condorcet_winner": self = .noCondorcetWinner(ranking: try c.decode(String.self, forKey: .ranking), pairwiseMatrix: try c.decode(String.self, forKey: .pairwiseMatrix)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .winner(let choice, let pairwiseMatrix): try c.encode("winner", forKey: .variant); try c.encode(choice, forKey: .choice); try c.encode(pairwiseMatrix, forKey: .pairwiseMatrix); case .noCondorcetWinner(let ranking, let pairwiseMatrix): try c.encode("no_condorcet_winner", forKey: .variant); try c.encode(ranking, forKey: .ranking); try c.encode(pairwiseMatrix, forKey: .pairwiseMatrix); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - ConsentProcess Types

public struct ConsentProcessOpenRoundInput: Codable {
    public let proposal: String
    public let facilitator: String
    public init(proposal: String, facilitator: String) { self.proposal = proposal; self.facilitator = facilitator }
}

public enum ConsentProcessOpenRoundOutput: Codable {
    case opened(round: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, round, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "opened": self = .opened(round: try c.decode(String.self, forKey: .round)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .opened(let round): try c.encode("opened", forKey: .variant); try c.encode(round, forKey: .round); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ConsentProcessAdvancePhaseInput: Codable {
    public let round: String
    public init(round: String) { self.round = round }
}

public enum ConsentProcessAdvancePhaseOutput: Codable {
    case advanced(round: String, phase: String)
    case unresolvedObjections(round: String, count: Int)
    case alreadyFinal(round: String, phase: String)
    case notFound(round: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, round, phase, count, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "advanced": self = .advanced(round: try c.decode(String.self, forKey: .round), phase: try c.decode(String.self, forKey: .phase)); case "unresolved_objections": self = .unresolvedObjections(round: try c.decode(String.self, forKey: .round), count: try c.decode(Int.self, forKey: .count)); case "already_final": self = .alreadyFinal(round: try c.decode(String.self, forKey: .round), phase: try c.decode(String.self, forKey: .phase)); case "not_found": self = .notFound(round: try c.decode(String.self, forKey: .round)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .advanced(let round, let phase): try c.encode("advanced", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(phase, forKey: .phase); case .unresolvedObjections(let round, let count): try c.encode("unresolved_objections", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(count, forKey: .count); case .alreadyFinal(let round, let phase): try c.encode("already_final", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(phase, forKey: .phase); case .notFound(let round): try c.encode("not_found", forKey: .variant); try c.encode(round, forKey: .round); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ConsentProcessRaiseObjectionInput: Codable {
    public let round: String
    public let raiser: String
    public let objection: String
    public init(round: String, raiser: String, objection: String) { self.round = round; self.raiser = raiser; self.objection = objection }
}

public enum ConsentProcessRaiseObjectionOutput: Codable {
    case objectionRaised(round: String, objectionId: String)
    case wrongPhase(round: String, phase: String)
    case notFound(round: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, round, objectionId, phase, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "objection_raised": self = .objectionRaised(round: try c.decode(String.self, forKey: .round), objectionId: try c.decode(String.self, forKey: .objectionId)); case "wrong_phase": self = .wrongPhase(round: try c.decode(String.self, forKey: .round), phase: try c.decode(String.self, forKey: .phase)); case "not_found": self = .notFound(round: try c.decode(String.self, forKey: .round)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .objectionRaised(let round, let objectionId): try c.encode("objection_raised", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(objectionId, forKey: .objectionId); case .wrongPhase(let round, let phase): try c.encode("wrong_phase", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(phase, forKey: .phase); case .notFound(let round): try c.encode("not_found", forKey: .variant); try c.encode(round, forKey: .round); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ConsentProcessResolveObjectionInput: Codable {
    public let round: String
    public let objection: String
    public let resolution: String
    public init(round: String, objection: String, resolution: String) { self.round = round; self.objection = objection; self.resolution = resolution }
}

public enum ConsentProcessResolveObjectionOutput: Codable {
    case objectionResolved(round: String)
    case objectionNotFound(round: String, objection: String)
    case notFound(round: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, round, objection, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "objection_resolved": self = .objectionResolved(round: try c.decode(String.self, forKey: .round)); case "objection_not_found": self = .objectionNotFound(round: try c.decode(String.self, forKey: .round), objection: try c.decode(String.self, forKey: .objection)); case "not_found": self = .notFound(round: try c.decode(String.self, forKey: .round)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .objectionResolved(let round): try c.encode("objection_resolved", forKey: .variant); try c.encode(round, forKey: .round); case .objectionNotFound(let round, let objection): try c.encode("objection_not_found", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(objection, forKey: .objection); case .notFound(let round): try c.encode("not_found", forKey: .variant); try c.encode(round, forKey: .round); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ConsentProcessFinalizeInput: Codable {
    public let round: String
    public init(round: String) { self.round = round }
}

public enum ConsentProcessFinalizeOutput: Codable {
    case consented(round: String, amendments: String)
    case unresolvedObjections(round: String, count: Int)
    case notFound(round: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, round, amendments, count, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "consented": self = .consented(round: try c.decode(String.self, forKey: .round), amendments: try c.decode(String.self, forKey: .amendments)); case "unresolved_objections": self = .unresolvedObjections(round: try c.decode(String.self, forKey: .round), count: try c.decode(Int.self, forKey: .count)); case "not_found": self = .notFound(round: try c.decode(String.self, forKey: .round)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .consented(let round, let amendments): try c.encode("consented", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(amendments, forKey: .amendments); case .unresolvedObjections(let round, let count): try c.encode("unresolved_objections", forKey: .variant); try c.encode(round, forKey: .round); try c.encode(count, forKey: .count); case .notFound(let round): try c.encode("not_found", forKey: .variant); try c.encode(round, forKey: .round); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - Handler Protocols

public protocol MajorityHandler {
    func configure(input: MajorityConfigureInput, storage: ConceptStorage) async throws -> MajorityConfigureOutput
    func count(input: MajorityCountInput, storage: ConceptStorage) async throws -> MajorityCountOutput
}

public protocol SupermajorityHandler {
    func configure(input: SupermajorityConfigureInput, storage: ConceptStorage) async throws -> SupermajorityConfigureOutput
    func count(input: SupermajorityCountInput, storage: ConceptStorage) async throws -> SupermajorityCountOutput
}

public protocol ApprovalCountingHandler {
    func configure(input: ApprovalCountingConfigureInput, storage: ConceptStorage) async throws -> ApprovalCountingConfigureOutput
    func count(input: ApprovalCountingCountInput, storage: ConceptStorage) async throws -> ApprovalCountingCountOutput
}

public protocol ScoreVotingHandler {
    func configure(input: ScoreVotingConfigureInput, storage: ConceptStorage) async throws -> ScoreVotingConfigureOutput
    func count(input: ScoreVotingCountInput, storage: ConceptStorage) async throws -> ScoreVotingCountOutput
}

public protocol BordaCountHandler {
    func configure(input: BordaCountConfigureInput, storage: ConceptStorage) async throws -> BordaCountConfigureOutput
    func count(input: BordaCountCountInput, storage: ConceptStorage) async throws -> BordaCountCountOutput
}

public protocol RankedChoiceHandler {
    func configure(input: RankedChoiceConfigureInput, storage: ConceptStorage) async throws -> RankedChoiceConfigureOutput
    func count(input: RankedChoiceCountInput, storage: ConceptStorage) async throws -> RankedChoiceCountOutput
}

public protocol QuadraticVotingHandler {
    func openSession(input: QuadraticVotingOpenSessionInput, storage: ConceptStorage) async throws -> QuadraticVotingOpenSessionOutput
    func castVotes(input: QuadraticVotingCastVotesInput, storage: ConceptStorage) async throws -> QuadraticVotingCastVotesOutput
    func tally(input: QuadraticVotingTallyInput, storage: ConceptStorage) async throws -> QuadraticVotingTallyOutput
}

public protocol CondorcetSchulzeHandler {
    func configure(input: CondorcetSchulzeConfigureInput, storage: ConceptStorage) async throws -> CondorcetSchulzeConfigureOutput
    func count(input: CondorcetSchulzeCountInput, storage: ConceptStorage) async throws -> CondorcetSchulzeCountOutput
}

public protocol ConsentProcessHandler {
    func openRound(input: ConsentProcessOpenRoundInput, storage: ConceptStorage) async throws -> ConsentProcessOpenRoundOutput
    func advancePhase(input: ConsentProcessAdvancePhaseInput, storage: ConceptStorage) async throws -> ConsentProcessAdvancePhaseOutput
    func raiseObjection(input: ConsentProcessRaiseObjectionInput, storage: ConceptStorage) async throws -> ConsentProcessRaiseObjectionOutput
    func resolveObjection(input: ConsentProcessResolveObjectionInput, storage: ConceptStorage) async throws -> ConsentProcessResolveObjectionOutput
    func finalize(input: ConsentProcessFinalizeInput, storage: ConceptStorage) async throws -> ConsentProcessFinalizeOutput
}

// MARK: - Consent Phase State Machine

private let consentPhases = ["Presenting", "Clarifying", "Reacting", "Objecting", "Integrating", "Consented"]

private func nextConsentPhase(_ current: String) -> String? {
    guard let idx = consentPhases.firstIndex(of: current), idx < consentPhases.count - 1 else { return nil }
    return consentPhases[idx + 1]
}

// MARK: - Handler Implementations

public struct MajorityHandlerImpl: MajorityHandler {
    public init() {}

    public func configure(input: MajorityConfigureInput, storage: ConceptStorage) async throws -> MajorityConfigureOutput {
        let id = "maj-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "majority", key: id, value: [
            "id": id, "threshold": input.threshold ?? 0.5,
            "binaryOnly": input.binaryOnly ?? true, "tieBreaker": input.tieBreaker as Any,
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "Majority", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func count(input: MajorityCountInput, storage: ConceptStorage) async throws -> MajorityCountOutput {
        let cfg = try await storage.get(relation: "majority", key: input.config)
        let threshold = (cfg?["threshold"] as? Double) ?? 0.5
        let tieBreaker = cfg?["tieBreaker"] as? String
        let weightMap = input.weights ?? [:]

        var tally: [String: Double] = [:]
        var totalWeight: Double = 0
        for ballot in input.ballots {
            let w = weightMap[ballot.voter] ?? 1
            tally[ballot.choice, default: 0] += w
            totalWeight += w
        }
        let entries = tally.sorted { $0.value > $1.value }
        guard let first = entries.first else { return .noVotes(totalWeight: 0) }

        let voteShare = totalWeight > 0 ? first.value / totalWeight : 0
        if entries.count > 1 && entries[0].value == entries[1].value {
            if let tb = tieBreaker { return .winner(choice: tb, voteShare: 0.5, totalWeight: totalWeight) }
            let tied = entries.filter { $0.value == first.value }.map { $0.key }
            let encoder = JSONEncoder()
            let tiedJson = String(data: try encoder.encode(tied), encoding: .utf8) ?? "[]"
            return .tie(choices: tiedJson, totalWeight: totalWeight)
        }
        if voteShare > threshold { return .winner(choice: first.key, voteShare: voteShare, totalWeight: totalWeight) }
        return .noMajority(topChoice: first.key, voteShare: voteShare, threshold: threshold, totalWeight: totalWeight)
    }
}

public struct SupermajorityHandlerImpl: SupermajorityHandler {
    public init() {}

    public func configure(input: SupermajorityConfigureInput, storage: ConceptStorage) async throws -> SupermajorityConfigureOutput {
        let id = "supermaj-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "supermajority", key: id, value: [
            "id": id, "threshold": input.threshold ?? (2.0 / 3.0),
            "roundingMode": input.roundingMode ?? "floor",
            "abstentionsCount": input.abstentionsCount ?? false,
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "Supermajority", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func count(input: SupermajorityCountInput, storage: ConceptStorage) async throws -> SupermajorityCountOutput {
        let cfg = try await storage.get(relation: "supermajority", key: input.config)
        let threshold = (cfg?["threshold"] as? Double) ?? (2.0 / 3.0)
        let abstentionsCount = (cfg?["abstentionsCount"] as? Bool) ?? false
        let weightMap = input.weights ?? [:]

        var tally: [String: Double] = [:]
        var totalWeight: Double = 0
        var abstainWeight: Double = 0
        for ballot in input.ballots {
            let w = weightMap[ballot.voter] ?? 1
            if ballot.choice == "abstain" {
                abstainWeight += w
                if abstentionsCount { totalWeight += w }
                continue
            }
            tally[ballot.choice, default: 0] += w
            totalWeight += w
        }
        let entries = tally.sorted { $0.value > $1.value }
        guard let first = entries.first else { return .noVotes(totalWeight: 0) }

        let voteShare = totalWeight > 0 ? first.value / totalWeight : 0
        if voteShare >= threshold {
            return .winner(choice: first.key, voteShare: voteShare, requiredShare: threshold, totalWeight: totalWeight, abstentions: abstainWeight)
        }
        return .noSupermajority(topChoice: first.key, voteShare: voteShare, requiredShare: threshold, totalWeight: totalWeight, abstentions: abstainWeight)
    }
}

public struct ApprovalCountingHandlerImpl: ApprovalCountingHandler {
    public init() {}

    public func configure(input: ApprovalCountingConfigureInput, storage: ConceptStorage) async throws -> ApprovalCountingConfigureOutput {
        let id = "approval-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "approval", key: id, value: [
            "id": id, "maxApprovals": input.maxApprovals as Any, "winnerCount": input.winnerCount ?? 1,
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "ApprovalCounting", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func count(input: ApprovalCountingCountInput, storage: ConceptStorage) async throws -> ApprovalCountingCountOutput {
        let weightMap = input.weights ?? [:]
        var tally: [String: Double] = [:]
        for ballot in input.ballots {
            let w = weightMap[ballot.voter] ?? 1
            for choice in ballot.approvals { tally[choice, default: 0] += w }
        }
        let ranked = tally.sorted { $0.value > $1.value }
        let topChoice = ranked.first?.key
        let topApproval = ranked.first?.value ?? 0
        let encoder = JSONEncoder()
        let rankedArray = ranked.map { ["choice": $0.key, "approvalWeight": $0.value] as [String: Any] }
        let rankedJson = String(data: try encoder.encode(ranked.map { ["choice": $0.key, "approvalWeight": $0.value] }), encoding: .utf8) ?? "[]"
        return .winners(rankedResults: rankedJson, topChoice: topChoice, approvalCount: topApproval)
    }
}

public struct ScoreVotingHandlerImpl: ScoreVotingHandler {
    public init() {}

    public func configure(input: ScoreVotingConfigureInput, storage: ConceptStorage) async throws -> ScoreVotingConfigureOutput {
        let id = "score-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "score_cfg", key: id, value: [
            "id": id, "minScore": input.minScore ?? 0, "maxScore": input.maxScore ?? 5,
            "aggregation": input.aggregation ?? "Mean",
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "ScoreVoting", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func count(input: ScoreVotingCountInput, storage: ConceptStorage) async throws -> ScoreVotingCountOutput {
        let cfg = try await storage.get(relation: "score_cfg", key: input.config)
        let aggregation = (cfg?["aggregation"] as? String) ?? "Mean"
        let weightMap = input.weights ?? [:]

        var perCandidate: [String: (weightedScores: [Double], weights: [Double])] = [:]
        for ballot in input.ballots {
            let w = weightMap[ballot.voter] ?? 1
            for (candidate, score) in ballot.scores {
                if perCandidate[candidate] == nil { perCandidate[candidate] = ([], []) }
                perCandidate[candidate]!.weightedScores.append(score * w)
                perCandidate[candidate]!.weights.append(w)
            }
        }

        var results: [(String, Double)] = []
        var distribution: [String: Double] = [:]
        for (candidate, data) in perCandidate {
            let aggregate: Double
            if aggregation == "Median" {
                let sorted = zip(data.weightedScores, data.weights).map { $0.0 / $0.1 }.sorted()
                let mid = sorted.count / 2
                aggregate = sorted.count % 2 != 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
            } else {
                let totalW = data.weights.reduce(0, +)
                aggregate = totalW > 0 ? data.weightedScores.reduce(0, +) / totalW : 0
            }
            results.append((candidate, aggregate))
            distribution[candidate] = aggregate
        }
        results.sort { $0.1 > $1.1 }
        let winner = results.first
        let encoder = JSONEncoder()
        let distJson = String(data: try encoder.encode(distribution), encoding: .utf8) ?? "{}"
        return .winner(choice: winner?.0, averageScore: winner?.1 ?? 0, distribution: distJson)
    }
}

public struct BordaCountHandlerImpl: BordaCountHandler {
    public init() {}

    public func configure(input: BordaCountConfigureInput, storage: ConceptStorage) async throws -> BordaCountConfigureOutput {
        let id = "borda-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "borda", key: id, value: [
            "id": id, "scheme": input.scheme ?? "Standard", "candidates": input.candidates,
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "BordaCount", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func count(input: BordaCountCountInput, storage: ConceptStorage) async throws -> BordaCountCountOutput {
        let cfg = try await storage.get(relation: "borda", key: input.config)
        let scheme = (cfg?["scheme"] as? String) ?? "Standard"
        let weightMap = input.weights ?? [:]
        var scores: [String: Double] = [:]

        for ballot in input.ballots {
            let w = weightMap[ballot.voter] ?? 1
            let n = ballot.ranking.count
            for (i, candidate) in ballot.ranking.enumerated() {
                let points: Double
                switch scheme {
                case "Modified": points = Double(n - i)
                case "Dowdall": points = 1.0 / Double(i + 1)
                default: points = Double(n - 1 - i) // Standard
                }
                scores[candidate, default: 0] += points * w
            }
        }

        let ranked = scores.sorted { $0.value > $1.value }
        let winner = ranked.first?.key
        let encoder = JSONEncoder()
        let scoresJson = String(data: try encoder.encode(Dictionary(uniqueKeysWithValues: ranked)), encoding: .utf8) ?? "{}"
        return .winner(choice: winner, scores: scoresJson)
    }
}

public struct RankedChoiceHandlerImpl: RankedChoiceHandler {
    public init() {}

    public func configure(input: RankedChoiceConfigureInput, storage: ConceptStorage) async throws -> RankedChoiceConfigureOutput {
        let id = "rcv-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "rcv", key: id, value: [
            "id": id, "seats": input.seats ?? 1, "method": input.method ?? "IRV",
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "RankedChoice", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func count(input: RankedChoiceCountInput, storage: ConceptStorage) async throws -> RankedChoiceCountOutput {
        let weightMap = input.weights ?? [:]
        let activeBallots = input.ballots.map { (ranking: $0.ranking, weight: weightMap[$0.voter] ?? 1) }
        var eliminated = Set<String>()
        let totalWeight = activeBallots.reduce(0.0) { $0 + $1.weight }
        let majority = totalWeight / 2
        var roundData: [[String: Any]] = []

        for round in 1...100 {
            var tally: [String: Double] = [:]
            for ballot in activeBallots {
                if let top = ballot.ranking.first(where: { !eliminated.contains($0) }) {
                    tally[top, default: 0] += ballot.weight
                }
            }
            let entries = tally.sorted { $0.value > $1.value }
            guard !entries.isEmpty else { break }

            if entries[0].value > majority {
                roundData.append(["round": round, "tally": tally, "eliminated": nil as String? as Any])
                let encoder = JSONEncoder()
                let winnersJson = String(data: try encoder.encode([entries[0].key]), encoding: .utf8) ?? "[]"
                let roundsJson = String(data: try JSONSerialization.data(withJSONObject: roundData), encoding: .utf8) ?? "[]"
                return .elected(winners: winnersJson, rounds: roundsJson)
            }

            let lowest = entries.last!.key
            eliminated.insert(lowest)
            roundData.append(["round": round, "tally": tally, "eliminated": lowest])

            let remaining = entries.filter { $0.key != lowest }
            if remaining.count <= 1 {
                let encoder = JSONEncoder()
                let winnersJson = String(data: try encoder.encode(remaining.map { $0.key }), encoding: .utf8) ?? "[]"
                let roundsJson = String(data: try JSONSerialization.data(withJSONObject: roundData), encoding: .utf8) ?? "[]"
                return .elected(winners: winnersJson, rounds: roundsJson)
            }
        }

        let roundsJson = String(data: try JSONSerialization.data(withJSONObject: roundData), encoding: .utf8) ?? "[]"
        return .exhausted(rounds: roundsJson)
    }
}

public struct QuadraticVotingHandlerImpl: QuadraticVotingHandler {
    public init() {}

    public func openSession(input: QuadraticVotingOpenSessionInput, storage: ConceptStorage) async throws -> QuadraticVotingOpenSessionOutput {
        let id = "qv-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "qv_session", key: id, value: [
            "id": id, "creditBudget": input.creditBudget, "options": input.options, "status": "open",
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "QuadraticVoting", "instanceId": id,
        ])
        return .opened(session: id)
    }

    public func castVotes(input: QuadraticVotingCastVotesInput, storage: ConceptStorage) async throws -> QuadraticVotingCastVotesOutput {
        guard let record = try await storage.get(relation: "qv_session", key: input.session) else {
            return .notFound(session: input.session)
        }
        guard (record["status"] as? String) == "open" else { return .sessionClosed(session: input.session) }

        let budget = (record["creditBudget"] as? Double) ?? 0
        var totalCost: Double = 0
        for votes in input.allocations.values { totalCost += votes * votes }
        if totalCost > budget { return .budgetExceeded(totalCost: totalCost, budget: budget) }

        let voteKey = "\(input.session):\(input.voter)"
        try await storage.put(relation: "qv_vote", key: voteKey, value: [
            "session": input.session, "voter": input.voter,
            "allocations": input.allocations, "totalCost": totalCost,
            "castAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .cast(session: input.session, totalCost: totalCost, remainingCredits: budget - totalCost)
    }

    public func tally(input: QuadraticVotingTallyInput, storage: ConceptStorage) async throws -> QuadraticVotingTallyOutput {
        guard let record = try await storage.get(relation: "qv_session", key: input.session) else {
            return .notFound(session: input.session)
        }
        let allVotes = try await storage.find(relation: "qv_vote", criteria: ["session": input.session])
        var votesByOption: [String: Double] = [:]
        for vote in allVotes {
            if let allocs = vote["allocations"] as? [String: Double] {
                for (option, votes) in allocs { votesByOption[option, default: 0] += votes }
            }
        }
        let ranked = votesByOption.sorted { $0.value > $1.value }
        let winner = ranked.first?.key
        var updated = record
        updated["status"] = "tallied"
        try await storage.put(relation: "qv_session", key: input.session, value: updated)
        let encoder = JSONEncoder()
        let votesJson = String(data: try encoder.encode(votesByOption), encoding: .utf8) ?? "{}"
        return .result(session: input.session, winner: winner, votesByOption: votesJson)
    }
}

public struct CondorcetSchulzeHandlerImpl: CondorcetSchulzeHandler {
    public init() {}

    public func configure(input: CondorcetSchulzeConfigureInput, storage: ConceptStorage) async throws -> CondorcetSchulzeConfigureOutput {
        let id = "condorcet-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "condorcet", key: id, value: [
            "id": id, "tieBreaker": input.tieBreaker as Any,
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "CondorcetSchulze", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func count(input: CondorcetSchulzeCountInput, storage: ConceptStorage) async throws -> CondorcetSchulzeCountOutput {
        let weightMap = input.weights ?? [:]
        var candidateSet = Set<String>()
        for b in input.ballots { for c in b.ranking { candidateSet.insert(c) } }
        let candidates = Array(candidateSet)
        let n = candidates.count
        var idx: [String: Int] = [:]
        for (i, c) in candidates.enumerated() { idx[c] = i }

        // Build pairwise preference matrix
        var d = Array(repeating: Array(repeating: 0.0, count: n), count: n)
        for ballot in input.ballots {
            let w = weightMap[ballot.voter] ?? 1
            for i in 0..<ballot.ranking.count {
                for j in (i + 1)..<ballot.ranking.count {
                    if let a = idx[ballot.ranking[i]], let b = idx[ballot.ranking[j]] {
                        d[a][b] += w
                    }
                }
            }
        }

        // Schulze: strongest paths via Floyd-Warshall
        var p = Array(repeating: Array(repeating: 0.0, count: n), count: n)
        for i in 0..<n {
            for j in 0..<n where i != j {
                if d[i][j] > d[j][i] { p[i][j] = d[i][j] }
            }
        }
        for k in 0..<n {
            for i in 0..<n where i != k {
                for j in 0..<n where j != i && j != k {
                    p[i][j] = max(p[i][j], min(p[i][k], p[k][j]))
                }
            }
        }

        // Find Condorcet winner
        var winner: String? = nil
        for i in 0..<n {
            var beatsAll = true
            for j in 0..<n where i != j {
                if p[i][j] <= p[j][i] { beatsAll = false; break }
            }
            if beatsAll { winner = candidates[i]; break }
        }

        // Build pairwise matrix JSON
        var pairwise: [String: [String: Double]] = [:]
        for i in 0..<n {
            pairwise[candidates[i]] = [:]
            for j in 0..<n where i != j { pairwise[candidates[i]]![candidates[j]] = d[i][j] }
        }
        let encoder = JSONEncoder()
        let matrixJson = String(data: try encoder.encode(pairwise), encoding: .utf8) ?? "{}"

        if let w = winner { return .winner(choice: w, pairwiseMatrix: matrixJson) }

        // Rank by number of pairwise wins
        var wins = candidates.enumerated().map { (i, c) -> (candidate: String, wins: Int) in
            let count = candidates.indices.filter { j in i != j && p[i][j] > p[j][i] }.count
            return (c, count)
        }
        wins.sort { $0.wins > $1.wins }
        let rankingJson = String(data: try encoder.encode(wins.map { ["candidate": $0.candidate, "wins": "\($0.wins)"] }), encoding: .utf8) ?? "[]"
        return .noCondorcetWinner(ranking: rankingJson, pairwiseMatrix: matrixJson)
    }
}

public struct ConsentProcessHandlerImpl: ConsentProcessHandler {
    public init() {}

    public func openRound(input: ConsentProcessOpenRoundInput, storage: ConceptStorage) async throws -> ConsentProcessOpenRoundOutput {
        let id = "consent-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "consent", key: id, value: [
            "id": id, "proposal": input.proposal, "facilitator": input.facilitator,
            "phase": "Presenting", "objections": "[]", "reactions": "[]", "amendments": "[]",
        ])
        try await storage.put(relation: "plugin-registry", key: "counting-method:\(id)", value: [
            "id": "counting-method:\(id)", "pluginKind": "counting-method",
            "provider": "ConsentProcess", "instanceId": id,
        ])
        return .opened(round: id)
    }

    public func advancePhase(input: ConsentProcessAdvancePhaseInput, storage: ConceptStorage) async throws -> ConsentProcessAdvancePhaseOutput {
        guard let record = try await storage.get(relation: "consent", key: input.round) else {
            return .notFound(round: input.round)
        }
        let currentPhase = (record["phase"] as? String) ?? "Presenting"

        if currentPhase == "Objecting" {
            if let objJson = record["objections"] as? String,
               let data = objJson.data(using: .utf8),
               let objs = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                let unresolved = objs.filter { ($0["resolved"] as? Bool) != true }
                if !unresolved.isEmpty { return .unresolvedObjections(round: input.round, count: unresolved.count) }
            }
        }

        guard let next = nextConsentPhase(currentPhase) else {
            return .alreadyFinal(round: input.round, phase: currentPhase)
        }
        var updated = record
        updated["phase"] = next
        try await storage.put(relation: "consent", key: input.round, value: updated)
        return .advanced(round: input.round, phase: next)
    }

    public func raiseObjection(input: ConsentProcessRaiseObjectionInput, storage: ConceptStorage) async throws -> ConsentProcessRaiseObjectionOutput {
        guard let record = try await storage.get(relation: "consent", key: input.round) else {
            return .notFound(round: input.round)
        }
        let phase = (record["phase"] as? String) ?? ""
        guard phase == "Objecting" || phase == "Reacting" else {
            return .wrongPhase(round: input.round, phase: phase)
        }

        let objId = "obj-\(Int(Date().timeIntervalSince1970 * 1000))"
        var objections: [[String: Any]] = []
        if let objJson = record["objections"] as? String,
           let data = objJson.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            objections = parsed
        }
        objections.append(["id": objId, "raiser": input.raiser, "text": input.objection, "resolved": false])
        var updated = record
        updated["phase"] = "Objecting"
        updated["objections"] = String(data: try JSONSerialization.data(withJSONObject: objections), encoding: .utf8) ?? "[]"
        try await storage.put(relation: "consent", key: input.round, value: updated)
        return .objectionRaised(round: input.round, objectionId: objId)
    }

    public func resolveObjection(input: ConsentProcessResolveObjectionInput, storage: ConceptStorage) async throws -> ConsentProcessResolveObjectionOutput {
        guard let record = try await storage.get(relation: "consent", key: input.round) else {
            return .notFound(round: input.round)
        }

        guard let objJson = record["objections"] as? String,
              let data = objJson.data(using: .utf8),
              var objections = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return .objectionNotFound(round: input.round, objection: input.objection)
        }

        guard let targetIdx = objections.firstIndex(where: { ($0["id"] as? String) == input.objection }) else {
            return .objectionNotFound(round: input.round, objection: input.objection)
        }

        objections[targetIdx]["resolved"] = true
        objections[targetIdx]["resolution"] = input.resolution

        var amendments: [[String: Any]] = []
        if let amJson = record["amendments"] as? String,
           let amData = amJson.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: amData) as? [[String: Any]] {
            amendments = parsed
        }
        amendments.append(["objectionId": input.objection, "resolution": input.resolution, "appliedAt": ISO8601DateFormatter().string(from: Date())])

        var updated = record
        updated["objections"] = String(data: try JSONSerialization.data(withJSONObject: objections), encoding: .utf8) ?? "[]"
        updated["amendments"] = String(data: try JSONSerialization.data(withJSONObject: amendments), encoding: .utf8) ?? "[]"
        try await storage.put(relation: "consent", key: input.round, value: updated)
        return .objectionResolved(round: input.round)
    }

    public func finalize(input: ConsentProcessFinalizeInput, storage: ConceptStorage) async throws -> ConsentProcessFinalizeOutput {
        guard let record = try await storage.get(relation: "consent", key: input.round) else {
            return .notFound(round: input.round)
        }

        if let objJson = record["objections"] as? String,
           let data = objJson.data(using: .utf8),
           let objs = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            let unresolved = objs.filter { ($0["resolved"] as? Bool) != true }
            if !unresolved.isEmpty { return .unresolvedObjections(round: input.round, count: unresolved.count) }
        }

        var updated = record
        updated["phase"] = "Consented"
        try await storage.put(relation: "consent", key: input.round, value: updated)
        let amendments = (record["amendments"] as? String) ?? "[]"
        return .consented(round: input.round, amendments: amendments)
    }
}
