// WeightProviders.swift — Governance Weight Source providers: TokenBalance, ReputationWeight, StakeWeight, EqualWeight, VoteEscrow, QuadraticWeight

import Foundation

// MARK: - TokenBalance Types

public struct TokenBalanceConfigureInput: Codable {
    public let tokenContract: String
    public let snapshotBlock: String?

    public init(tokenContract: String, snapshotBlock: String? = nil) {
        self.tokenContract = tokenContract
        self.snapshotBlock = snapshotBlock
    }
}

public enum TokenBalanceConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, config, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "configured": self = .configured(config: try c.decode(String.self, forKey: .config))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .configured(let config):
            try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct TokenBalanceSetBalanceInput: Codable {
    public let config: String
    public let participant: String
    public let balance: Double

    public init(config: String, participant: String, balance: Double) {
        self.config = config; self.participant = participant; self.balance = balance
    }
}

public enum TokenBalanceSetBalanceOutput: Codable {
    case updated(participant: String, balance: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, participant, balance, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "updated": self = .updated(participant: try c.decode(String.self, forKey: .participant), balance: try c.decode(Double.self, forKey: .balance)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .updated(let participant, let balance): try c.encode("updated", forKey: .variant); try c.encode(participant, forKey: .participant); try c.encode(balance, forKey: .balance); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct TokenBalanceTakeSnapshotInput: Codable {
    public let config: String
    public let blockRef: String
    public init(config: String, blockRef: String) { self.config = config; self.blockRef = blockRef }
}

public enum TokenBalanceTakeSnapshotOutput: Codable {
    case snapped(snapshot: String, participantCount: Int)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, snapshot, participantCount, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "snapped": self = .snapped(snapshot: try c.decode(String.self, forKey: .snapshot), participantCount: try c.decode(Int.self, forKey: .participantCount)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .snapped(let snapshot, let participantCount): try c.encode("snapped", forKey: .variant); try c.encode(snapshot, forKey: .snapshot); try c.encode(participantCount, forKey: .participantCount); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct TokenBalanceGetBalanceInput: Codable {
    public let config: String
    public let participant: String
    public let snapshot: String?
    public init(config: String, participant: String, snapshot: String? = nil) { self.config = config; self.participant = participant; self.snapshot = snapshot }
}

public enum TokenBalanceGetBalanceOutput: Codable {
    case balance(participant: String, balance: Double)
    case notFound(snapshot: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, participant, balance, snapshot, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "balance": self = .balance(participant: try c.decode(String.self, forKey: .participant), balance: try c.decode(Double.self, forKey: .balance)); case "not_found": self = .notFound(snapshot: try c.decode(String.self, forKey: .snapshot)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .balance(let participant, let balance): try c.encode("balance", forKey: .variant); try c.encode(participant, forKey: .participant); try c.encode(balance, forKey: .balance); case .notFound(let snapshot): try c.encode("not_found", forKey: .variant); try c.encode(snapshot, forKey: .snapshot); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - ReputationWeight Types

public struct ReputationWeightConfigureInput: Codable {
    public let scalingFunction: String?
    public let cap: Double?
    public init(scalingFunction: String? = nil, cap: Double? = nil) { self.scalingFunction = scalingFunction; self.cap = cap }
}

public enum ReputationWeightConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ReputationWeightComputeInput: Codable {
    public let config: String
    public let participant: String
    public let reputationScore: Double
    public init(config: String, participant: String, reputationScore: Double) { self.config = config; self.participant = participant; self.reputationScore = reputationScore }
}

public enum ReputationWeightComputeOutput: Codable {
    case weight(participant: String, weight: Double, rawScore: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, participant, weight, rawScore, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "weight": self = .weight(participant: try c.decode(String.self, forKey: .participant), weight: try c.decode(Double.self, forKey: .weight), rawScore: try c.decode(Double.self, forKey: .rawScore)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .weight(let participant, let weight, let rawScore): try c.encode("weight", forKey: .variant); try c.encode(participant, forKey: .participant); try c.encode(weight, forKey: .weight); try c.encode(rawScore, forKey: .rawScore); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - StakeWeight Types

public struct StakeWeightConfigureInput: Codable {
    public let token: String
    public let cooldownDays: Int?
    public init(token: String, cooldownDays: Int? = nil) { self.token = token; self.cooldownDays = cooldownDays }
}

public enum StakeWeightConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct StakeWeightStakeInput: Codable {
    public let config: String
    public let staker: String
    public let amount: Double
    public init(config: String, staker: String, amount: Double) { self.config = config; self.staker = staker; self.amount = amount }
}

public enum StakeWeightStakeOutput: Codable {
    case staked(stake: String, lockedUntil: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, stake, lockedUntil, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "staked": self = .staked(stake: try c.decode(String.self, forKey: .stake), lockedUntil: try c.decode(String.self, forKey: .lockedUntil)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .staked(let stake, let lockedUntil): try c.encode("staked", forKey: .variant); try c.encode(stake, forKey: .stake); try c.encode(lockedUntil, forKey: .lockedUntil); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct StakeWeightUnstakeInput: Codable {
    public let stake: String
    public init(stake: String) { self.stake = stake }
}

public enum StakeWeightUnstakeOutput: Codable {
    case unstaked(stake: String, amount: Double)
    case locked(stake: String, lockedUntil: String)
    case notFound(stake: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, stake, amount, lockedUntil, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "unstaked": self = .unstaked(stake: try c.decode(String.self, forKey: .stake), amount: try c.decode(Double.self, forKey: .amount)); case "locked": self = .locked(stake: try c.decode(String.self, forKey: .stake), lockedUntil: try c.decode(String.self, forKey: .lockedUntil)); case "not_found": self = .notFound(stake: try c.decode(String.self, forKey: .stake)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .unstaked(let stake, let amount): try c.encode("unstaked", forKey: .variant); try c.encode(stake, forKey: .stake); try c.encode(amount, forKey: .amount); case .locked(let stake, let lockedUntil): try c.encode("locked", forKey: .variant); try c.encode(stake, forKey: .stake); try c.encode(lockedUntil, forKey: .lockedUntil); case .notFound(let stake): try c.encode("not_found", forKey: .variant); try c.encode(stake, forKey: .stake); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct StakeWeightGetWeightInput: Codable {
    public let config: String
    public let participant: String
    public init(config: String, participant: String) { self.config = config; self.participant = participant }
}

public enum StakeWeightGetWeightOutput: Codable {
    case weight(participant: String, stakedAmount: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, participant, stakedAmount, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "weight": self = .weight(participant: try c.decode(String.self, forKey: .participant), stakedAmount: try c.decode(Double.self, forKey: .stakedAmount)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .weight(let participant, let stakedAmount): try c.encode("weight", forKey: .variant); try c.encode(participant, forKey: .participant); try c.encode(stakedAmount, forKey: .stakedAmount); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - EqualWeight Types

public struct EqualWeightConfigureInput: Codable {
    public let weightPerPerson: Double?
    public init(weightPerPerson: Double? = nil) { self.weightPerPerson = weightPerPerson }
}

public enum EqualWeightConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct EqualWeightGetWeightInput: Codable {
    public let config: String
    public let participant: String
    public init(config: String, participant: String) { self.config = config; self.participant = participant }
}

public enum EqualWeightGetWeightOutput: Codable {
    case weight(participant: String, weight: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, participant, weight, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "weight": self = .weight(participant: try c.decode(String.self, forKey: .participant), weight: try c.decode(Double.self, forKey: .weight)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .weight(let participant, let weight): try c.encode("weight", forKey: .variant); try c.encode(participant, forKey: .participant); try c.encode(weight, forKey: .weight); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - VoteEscrow Types

public struct VoteEscrowConfigureInput: Codable {
    public let token: String
    public let maxLockYears: Int?
    public init(token: String, maxLockYears: Int? = nil) { self.token = token; self.maxLockYears = maxLockYears }
}

public enum VoteEscrowConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct VoteEscrowLockInput: Codable {
    public let config: String
    public let locker: String
    public let amount: Double
    public let lockYears: Double
    public init(config: String, locker: String, amount: Double, lockYears: Double) { self.config = config; self.locker = locker; self.amount = amount; self.lockYears = lockYears }
}

public enum VoteEscrowLockOutput: Codable {
    case locked(lock: String, veTokens: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, lock, veTokens, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "locked": self = .locked(lock: try c.decode(String.self, forKey: .lock), veTokens: try c.decode(Double.self, forKey: .veTokens)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .locked(let lock, let veTokens): try c.encode("locked", forKey: .variant); try c.encode(lock, forKey: .lock); try c.encode(veTokens, forKey: .veTokens); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct VoteEscrowExtendLockInput: Codable {
    public let lock: String
    public let additionalYears: Double
    public init(lock: String, additionalYears: Double) { self.lock = lock; self.additionalYears = additionalYears }
}

public enum VoteEscrowExtendLockOutput: Codable {
    case extended(lock: String, veTokens: Double, newLockYears: Double)
    case notFound(lock: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, lock, veTokens, newLockYears, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "extended": self = .extended(lock: try c.decode(String.self, forKey: .lock), veTokens: try c.decode(Double.self, forKey: .veTokens), newLockYears: try c.decode(Double.self, forKey: .newLockYears)); case "not_found": self = .notFound(lock: try c.decode(String.self, forKey: .lock)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .extended(let lock, let veTokens, let newLockYears): try c.encode("extended", forKey: .variant); try c.encode(lock, forKey: .lock); try c.encode(veTokens, forKey: .veTokens); try c.encode(newLockYears, forKey: .newLockYears); case .notFound(let lock): try c.encode("not_found", forKey: .variant); try c.encode(lock, forKey: .lock); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct VoteEscrowGetWeightInput: Codable {
    public let config: String
    public let participant: String
    public init(config: String, participant: String) { self.config = config; self.participant = participant }
}

public enum VoteEscrowGetWeightOutput: Codable {
    case weight(participant: String, veTokens: Double, decayedWeight: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, participant, veTokens, decayedWeight, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "weight": self = .weight(participant: try c.decode(String.self, forKey: .participant), veTokens: try c.decode(Double.self, forKey: .veTokens), decayedWeight: try c.decode(Double.self, forKey: .decayedWeight)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .weight(let participant, let veTokens, let decayedWeight): try c.encode("weight", forKey: .variant); try c.encode(participant, forKey: .participant); try c.encode(veTokens, forKey: .veTokens); try c.encode(decayedWeight, forKey: .decayedWeight); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - QuadraticWeight Types

public struct QuadraticWeightConfigureInput: Codable {
    public let baseSource: String
    public init(baseSource: String) { self.baseSource = baseSource }
}

public enum QuadraticWeightConfigureOutput: Codable {
    case configured(config: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, config, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct QuadraticWeightComputeInput: Codable {
    public let config: String
    public let participant: String
    public let balance: Double
    public init(config: String, participant: String, balance: Double) { self.config = config; self.participant = participant; self.balance = balance }
}

public enum QuadraticWeightComputeOutput: Codable {
    case weight(participant: String, balance: Double, sqrtWeight: Double)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, participant, balance, sqrtWeight, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "weight": self = .weight(participant: try c.decode(String.self, forKey: .participant), balance: try c.decode(Double.self, forKey: .balance), sqrtWeight: try c.decode(Double.self, forKey: .sqrtWeight)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .weight(let participant, let balance, let sqrtWeight): try c.encode("weight", forKey: .variant); try c.encode(participant, forKey: .participant); try c.encode(balance, forKey: .balance); try c.encode(sqrtWeight, forKey: .sqrtWeight); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - Handler Protocols

public protocol TokenBalanceHandler {
    func configure(input: TokenBalanceConfigureInput, storage: ConceptStorage) async throws -> TokenBalanceConfigureOutput
    func setBalance(input: TokenBalanceSetBalanceInput, storage: ConceptStorage) async throws -> TokenBalanceSetBalanceOutput
    func takeSnapshot(input: TokenBalanceTakeSnapshotInput, storage: ConceptStorage) async throws -> TokenBalanceTakeSnapshotOutput
    func getBalance(input: TokenBalanceGetBalanceInput, storage: ConceptStorage) async throws -> TokenBalanceGetBalanceOutput
}

public protocol ReputationWeightHandler {
    func configure(input: ReputationWeightConfigureInput, storage: ConceptStorage) async throws -> ReputationWeightConfigureOutput
    func compute(input: ReputationWeightComputeInput, storage: ConceptStorage) async throws -> ReputationWeightComputeOutput
}

public protocol StakeWeightHandler {
    func configure(input: StakeWeightConfigureInput, storage: ConceptStorage) async throws -> StakeWeightConfigureOutput
    func stake(input: StakeWeightStakeInput, storage: ConceptStorage) async throws -> StakeWeightStakeOutput
    func unstake(input: StakeWeightUnstakeInput, storage: ConceptStorage) async throws -> StakeWeightUnstakeOutput
    func getWeight(input: StakeWeightGetWeightInput, storage: ConceptStorage) async throws -> StakeWeightGetWeightOutput
}

public protocol EqualWeightHandler {
    func configure(input: EqualWeightConfigureInput, storage: ConceptStorage) async throws -> EqualWeightConfigureOutput
    func getWeight(input: EqualWeightGetWeightInput, storage: ConceptStorage) async throws -> EqualWeightGetWeightOutput
}

public protocol VoteEscrowHandler {
    func configure(input: VoteEscrowConfigureInput, storage: ConceptStorage) async throws -> VoteEscrowConfigureOutput
    func lock(input: VoteEscrowLockInput, storage: ConceptStorage) async throws -> VoteEscrowLockOutput
    func extendLock(input: VoteEscrowExtendLockInput, storage: ConceptStorage) async throws -> VoteEscrowExtendLockOutput
    func getWeight(input: VoteEscrowGetWeightInput, storage: ConceptStorage) async throws -> VoteEscrowGetWeightOutput
}

public protocol QuadraticWeightHandler {
    func configure(input: QuadraticWeightConfigureInput, storage: ConceptStorage) async throws -> QuadraticWeightConfigureOutput
    func compute(input: QuadraticWeightComputeInput, storage: ConceptStorage) async throws -> QuadraticWeightComputeOutput
}

// MARK: - Scaling Helper

private func applyScaling(score: Double, fn: String, cap: Double?) -> Double {
    var scaled: Double
    switch fn {
    case "log":
        scaled = score > 0 ? log(1 + score) : 0
    case "sigmoid":
        scaled = 1 / (1 + exp(-score))
    default:
        scaled = score
    }
    if let cap = cap, scaled > cap { scaled = cap }
    return scaled
}

// MARK: - Handler Implementations

public struct TokenBalanceHandlerImpl: TokenBalanceHandler {
    public init() {}

    public func configure(input: TokenBalanceConfigureInput, storage: ConceptStorage) async throws -> TokenBalanceConfigureOutput {
        let id = "tb-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "tb_cfg", key: id, value: [
            "id": id,
            "tokenContract": input.tokenContract,
            "snapshotBlock": input.snapshotBlock as Any,
        ])
        try await storage.put(relation: "plugin-registry", key: "weight-source:\(id)", value: [
            "id": "weight-source:\(id)", "pluginKind": "weight-source",
            "provider": "TokenBalance", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func setBalance(input: TokenBalanceSetBalanceInput, storage: ConceptStorage) async throws -> TokenBalanceSetBalanceOutput {
        let key = "\(input.config):\(input.participant)"
        try await storage.put(relation: "tb_balance", key: key, value: [
            "config": input.config, "participant": input.participant,
            "balance": input.balance, "updatedAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .updated(participant: input.participant, balance: input.balance)
    }

    public func takeSnapshot(input: TokenBalanceTakeSnapshotInput, storage: ConceptStorage) async throws -> TokenBalanceTakeSnapshotOutput {
        let id = "tb-snap-\(Int(Date().timeIntervalSince1970 * 1000))"
        let balances = try await storage.find(relation: "tb_balance", criteria: ["config": input.config])
        var snapshotData: [String: Any] = [:]
        for b in balances {
            if let participant = b["participant"] as? String, let balance = b["balance"] {
                snapshotData[participant] = balance
            }
        }
        try await storage.put(relation: "tb_snapshot", key: id, value: [
            "id": id, "config": input.config, "blockRef": input.blockRef,
            "balances": snapshotData, "takenAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .snapped(snapshot: id, participantCount: balances.count)
    }

    public func getBalance(input: TokenBalanceGetBalanceInput, storage: ConceptStorage) async throws -> TokenBalanceGetBalanceOutput {
        if let snapshot = input.snapshot {
            guard let snap = try await storage.get(relation: "tb_snapshot", key: snapshot) else {
                return .notFound(snapshot: snapshot)
            }
            let balances = snap["balances"] as? [String: Any] ?? [:]
            let balance = (balances[input.participant] as? Double) ?? 0
            return .balance(participant: input.participant, balance: balance)
        }
        let key = "\(input.config):\(input.participant)"
        let record = try await storage.get(relation: "tb_balance", key: key)
        let balance = (record?["balance"] as? Double) ?? 0
        return .balance(participant: input.participant, balance: balance)
    }
}

public struct ReputationWeightHandlerImpl: ReputationWeightHandler {
    public init() {}

    public func configure(input: ReputationWeightConfigureInput, storage: ConceptStorage) async throws -> ReputationWeightConfigureOutput {
        let id = "rw-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "rw_cfg", key: id, value: [
            "id": id,
            "scalingFunction": input.scalingFunction ?? "linear",
            "cap": input.cap as Any,
        ])
        try await storage.put(relation: "plugin-registry", key: "weight-source:\(id)", value: [
            "id": "weight-source:\(id)", "pluginKind": "weight-source",
            "provider": "ReputationWeight", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func compute(input: ReputationWeightComputeInput, storage: ConceptStorage) async throws -> ReputationWeightComputeOutput {
        let cfg = try await storage.get(relation: "rw_cfg", key: input.config)
        let scalingFn = (cfg?["scalingFunction"] as? String) ?? "linear"
        let cap = cfg?["cap"] as? Double
        let weight = applyScaling(score: input.reputationScore, fn: scalingFn, cap: cap)
        return .weight(participant: input.participant, weight: weight, rawScore: input.reputationScore)
    }
}

public struct StakeWeightHandlerImpl: StakeWeightHandler {
    public init() {}

    public func configure(input: StakeWeightConfigureInput, storage: ConceptStorage) async throws -> StakeWeightConfigureOutput {
        let id = "sw-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "sw_cfg", key: id, value: [
            "id": id, "token": input.token, "cooldownDays": input.cooldownDays ?? 0,
        ])
        try await storage.put(relation: "plugin-registry", key: "weight-source:\(id)", value: [
            "id": "weight-source:\(id)", "pluginKind": "weight-source",
            "provider": "StakeWeight", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func stake(input: StakeWeightStakeInput, storage: ConceptStorage) async throws -> StakeWeightStakeOutput {
        let cfg = try await storage.get(relation: "sw_cfg", key: input.config)
        let cooldownDays = (cfg?["cooldownDays"] as? Int) ?? 0
        let id = "stake-\(Int(Date().timeIntervalSince1970 * 1000))"
        let lockedUntil = ISO8601DateFormatter().string(from: Date().addingTimeInterval(Double(cooldownDays) * 86400))
        try await storage.put(relation: "sw_stake", key: id, value: [
            "id": id, "config": input.config, "staker": input.staker,
            "amount": input.amount, "lockedUntil": lockedUntil, "status": "active",
            "stakedAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .staked(stake: id, lockedUntil: lockedUntil)
    }

    public func unstake(input: StakeWeightUnstakeInput, storage: ConceptStorage) async throws -> StakeWeightUnstakeOutput {
        guard let record = try await storage.get(relation: "sw_stake", key: input.stake) else {
            return .notFound(stake: input.stake)
        }
        if let lockedUntilStr = record["lockedUntil"] as? String,
           let lockedUntil = ISO8601DateFormatter().date(from: lockedUntilStr),
           Date() < lockedUntil {
            return .locked(stake: input.stake, lockedUntil: lockedUntilStr)
        }
        var updated = record
        updated["status"] = "unstaked"
        try await storage.put(relation: "sw_stake", key: input.stake, value: updated)
        let amount = (record["amount"] as? Double) ?? 0
        return .unstaked(stake: input.stake, amount: amount)
    }

    public func getWeight(input: StakeWeightGetWeightInput, storage: ConceptStorage) async throws -> StakeWeightGetWeightOutput {
        let allStakes = try await storage.find(relation: "sw_stake", criteria: ["config": input.config, "staker": input.participant])
        var totalStaked: Double = 0
        for s in allStakes {
            if (s["status"] as? String) == "active" {
                totalStaked += (s["amount"] as? Double) ?? 0
            }
        }
        return .weight(participant: input.participant, stakedAmount: totalStaked)
    }
}

public struct EqualWeightHandlerImpl: EqualWeightHandler {
    public init() {}

    public func configure(input: EqualWeightConfigureInput, storage: ConceptStorage) async throws -> EqualWeightConfigureOutput {
        let id = "ew-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "ew_cfg", key: id, value: [
            "id": id, "weightPerPerson": input.weightPerPerson ?? 1.0,
        ])
        try await storage.put(relation: "plugin-registry", key: "weight-source:\(id)", value: [
            "id": "weight-source:\(id)", "pluginKind": "weight-source",
            "provider": "EqualWeight", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func getWeight(input: EqualWeightGetWeightInput, storage: ConceptStorage) async throws -> EqualWeightGetWeightOutput {
        let record = try await storage.get(relation: "ew_cfg", key: input.config)
        let weight = (record?["weightPerPerson"] as? Double) ?? 1.0
        return .weight(participant: input.participant, weight: weight)
    }
}

public struct VoteEscrowHandlerImpl: VoteEscrowHandler {
    public init() {}

    public func configure(input: VoteEscrowConfigureInput, storage: ConceptStorage) async throws -> VoteEscrowConfigureOutput {
        let id = "ve-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "ve_cfg", key: id, value: [
            "id": id, "token": input.token, "maxLockYears": input.maxLockYears ?? 4,
        ])
        try await storage.put(relation: "plugin-registry", key: "weight-source:\(id)", value: [
            "id": "weight-source:\(id)", "pluginKind": "weight-source",
            "provider": "VoteEscrow", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func lock(input: VoteEscrowLockInput, storage: ConceptStorage) async throws -> VoteEscrowLockOutput {
        let cfg = try await storage.get(relation: "ve_cfg", key: input.config)
        let maxLockYears = Double((cfg?["maxLockYears"] as? Int) ?? 4)
        let years = min(input.lockYears, maxLockYears)
        let id = "lock-\(Int(Date().timeIntervalSince1970 * 1000))"
        let expiresAt = ISO8601DateFormatter().string(from: Date().addingTimeInterval(years * 365.25 * 86400))
        let veTokens = input.amount * (years / maxLockYears)
        try await storage.put(relation: "ve_lock", key: id, value: [
            "id": id, "config": input.config, "locker": input.locker,
            "amount": input.amount, "lockYears": years, "expiresAt": expiresAt,
            "veTokens": veTokens, "createdAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .locked(lock: id, veTokens: veTokens)
    }

    public func extendLock(input: VoteEscrowExtendLockInput, storage: ConceptStorage) async throws -> VoteEscrowExtendLockOutput {
        guard let record = try await storage.get(relation: "ve_lock", key: input.lock) else {
            return .notFound(lock: input.lock)
        }
        let configId = record["config"] as? String ?? ""
        let cfg = try await storage.get(relation: "ve_cfg", key: configId)
        let maxLockYears = Double((cfg?["maxLockYears"] as? Int) ?? 4)
        let currentYears = (record["lockYears"] as? Double) ?? 0
        let newYears = min(currentYears + input.additionalYears, maxLockYears)
        let expiresAt = ISO8601DateFormatter().string(from: Date().addingTimeInterval(newYears * 365.25 * 86400))
        let amount = (record["amount"] as? Double) ?? 0
        let veTokens = amount * (newYears / maxLockYears)
        var updated = record
        updated["lockYears"] = newYears
        updated["expiresAt"] = expiresAt
        updated["veTokens"] = veTokens
        try await storage.put(relation: "ve_lock", key: input.lock, value: updated)
        return .extended(lock: input.lock, veTokens: veTokens, newLockYears: newYears)
    }

    public func getWeight(input: VoteEscrowGetWeightInput, storage: ConceptStorage) async throws -> VoteEscrowGetWeightOutput {
        let locks = try await storage.find(relation: "ve_lock", criteria: ["config": input.config, "locker": input.participant])
        let cfg = try await storage.get(relation: "ve_cfg", key: input.config)
        let maxLockYears = Double((cfg?["maxLockYears"] as? Int) ?? 4)
        let maxLockSec = maxLockYears * 365.25 * 86400
        let now = Date()
        var totalVeTokens: Double = 0
        var totalDecayed: Double = 0
        for lock in locks {
            if let expiresStr = lock["expiresAt"] as? String,
               let expires = ISO8601DateFormatter().date(from: expiresStr) {
                let remaining = max(0, expires.timeIntervalSince(now))
                let decayFactor = remaining / maxLockSec
                let amount = (lock["amount"] as? Double) ?? 0
                totalDecayed += amount * decayFactor
            }
            totalVeTokens += (lock["veTokens"] as? Double) ?? 0
        }
        return .weight(participant: input.participant, veTokens: totalVeTokens, decayedWeight: totalDecayed)
    }
}

public struct QuadraticWeightHandlerImpl: QuadraticWeightHandler {
    public init() {}

    public func configure(input: QuadraticWeightConfigureInput, storage: ConceptStorage) async throws -> QuadraticWeightConfigureOutput {
        let id = "qw-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "qw_cfg", key: id, value: [
            "id": id, "baseSource": input.baseSource,
        ])
        try await storage.put(relation: "plugin-registry", key: "weight-source:\(id)", value: [
            "id": "weight-source:\(id)", "pluginKind": "weight-source",
            "provider": "QuadraticWeight", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func compute(input: QuadraticWeightComputeInput, storage: ConceptStorage) async throws -> QuadraticWeightComputeOutput {
        let weight = sqrt(input.balance)
        return .weight(participant: input.participant, balance: input.balance, sqrtWeight: weight)
    }
}
