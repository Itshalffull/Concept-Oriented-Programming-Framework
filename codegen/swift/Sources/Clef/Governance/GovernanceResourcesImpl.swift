// GovernanceResourcesImpl.swift — Governance Resources suite: Treasury, Reputation, Metric, Objective, BondingCurve

import Foundation

// MARK: - Treasury Types

public struct TreasuryDepositInput: Codable {
    public let treasuryId: String
    public let fromId: String
    public let amount: String
    public let asset: String

    public init(treasuryId: String, fromId: String, amount: String, asset: String) {
        self.treasuryId = treasuryId
        self.fromId = fromId
        self.amount = amount
        self.asset = asset
    }
}

public enum TreasuryDepositOutput: Codable {
    case ok(treasuryId: String, balance: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey { case variant, treasuryId, balance, message }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let v = try c.decode(String.self, forKey: .variant)
        switch v {
        case "ok": self = .ok(treasuryId: try c.decode(String.self, forKey: .treasuryId), balance: try c.decode(String.self, forKey: .balance))
        case "error": self = .error(message: try c.decode(String.self, forKey: .message))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let treasuryId, let balance):
            try c.encode("ok", forKey: .variant); try c.encode(treasuryId, forKey: .treasuryId); try c.encode(balance, forKey: .balance)
        case .error(let message):
            try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message)
        }
    }
}

public struct TreasuryWithdrawInput: Codable {
    public let treasuryId: String
    public let toId: String
    public let amount: String
    public let asset: String
    public init(treasuryId: String, toId: String, amount: String, asset: String) { self.treasuryId = treasuryId; self.toId = toId; self.amount = amount; self.asset = asset }
}

public enum TreasuryWithdrawOutput: Codable {
    case ok(treasuryId: String, balance: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, treasuryId, balance, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(treasuryId: try c.decode(String.self, forKey: .treasuryId), balance: try c.decode(String.self, forKey: .balance)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let treasuryId, let balance): try c.encode("ok", forKey: .variant); try c.encode(treasuryId, forKey: .treasuryId); try c.encode(balance, forKey: .balance); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct TreasuryAllocateInput: Codable {
    public let treasuryId: String
    public let proposalId: String
    public let amount: String
    public init(treasuryId: String, proposalId: String, amount: String) { self.treasuryId = treasuryId; self.proposalId = proposalId; self.amount = amount }
}

public enum TreasuryAllocateOutput: Codable {
    case ok(allocationId: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, allocationId, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(allocationId: try c.decode(String.self, forKey: .allocationId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let allocationId): try c.encode("ok", forKey: .variant); try c.encode(allocationId, forKey: .allocationId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct TreasuryReleaseAllocationInput: Codable {
    public let allocationId: String
    public init(allocationId: String) { self.allocationId = allocationId }
}

public enum TreasuryReleaseAllocationOutput: Codable {
    case ok(allocationId: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, allocationId, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(allocationId: try c.decode(String.self, forKey: .allocationId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let allocationId): try c.encode("ok", forKey: .variant); try c.encode(allocationId, forKey: .allocationId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - Reputation Types

public struct ReputationEarnInput: Codable { public let memberId: String; public let amount: String; public let reason: String; public init(memberId: String, amount: String, reason: String) { self.memberId = memberId; self.amount = amount; self.reason = reason } }
public enum ReputationEarnOutput: Codable { case ok(memberId: String, newScore: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, memberId, newScore, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(memberId: try c.decode(String.self, forKey: .memberId), newScore: try c.decode(String.self, forKey: .newScore)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let memberId, let newScore): try c.encode("ok", forKey: .variant); try c.encode(memberId, forKey: .memberId); try c.encode(newScore, forKey: .newScore); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ReputationBurnInput: Codable { public let memberId: String; public let amount: String; public let reason: String; public init(memberId: String, amount: String, reason: String) { self.memberId = memberId; self.amount = amount; self.reason = reason } }
public enum ReputationBurnOutput: Codable { case ok(memberId: String, newScore: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, memberId, newScore, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(memberId: try c.decode(String.self, forKey: .memberId), newScore: try c.decode(String.self, forKey: .newScore)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let memberId, let newScore): try c.encode("ok", forKey: .variant); try c.encode(memberId, forKey: .memberId); try c.encode(newScore, forKey: .newScore); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ReputationDecayInput: Codable { public let polityId: String; public let decayRate: String; public init(polityId: String, decayRate: String) { self.polityId = polityId; self.decayRate = decayRate } }
public enum ReputationDecayOutput: Codable { case ok(polityId: String, membersAffected: Int); case error(message: String); enum CodingKeys: String, CodingKey { case variant, polityId, membersAffected, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(polityId: try c.decode(String.self, forKey: .polityId), membersAffected: try c.decode(Int.self, forKey: .membersAffected)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let polityId, let membersAffected): try c.encode("ok", forKey: .variant); try c.encode(polityId, forKey: .polityId); try c.encode(membersAffected, forKey: .membersAffected); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ReputationGetScoreInput: Codable { public let memberId: String; public init(memberId: String) { self.memberId = memberId } }
public enum ReputationGetScoreOutput: Codable { case ok(memberId: String, score: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, memberId, score, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(memberId: try c.decode(String.self, forKey: .memberId), score: try c.decode(String.self, forKey: .score)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let memberId, let score): try c.encode("ok", forKey: .variant); try c.encode(memberId, forKey: .memberId); try c.encode(score, forKey: .score); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ReputationRecalculateInput: Codable { public let memberId: String; public init(memberId: String) { self.memberId = memberId } }
public enum ReputationRecalculateOutput: Codable { case ok(memberId: String, newScore: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, memberId, newScore, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(memberId: try c.decode(String.self, forKey: .memberId), newScore: try c.decode(String.self, forKey: .newScore)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let memberId, let newScore): try c.encode("ok", forKey: .variant); try c.encode(memberId, forKey: .memberId); try c.encode(newScore, forKey: .newScore); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Metric Types

public struct MetricDefineInput: Codable { public let name: String; public let formula: String; public let unit: String; public init(name: String, formula: String, unit: String) { self.name = name; self.formula = formula; self.unit = unit } }
public enum MetricDefineOutput: Codable { case ok(metricId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, metricId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(metricId: try c.decode(String.self, forKey: .metricId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let metricId): try c.encode("ok", forKey: .variant); try c.encode(metricId, forKey: .metricId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MetricUpdateInput: Codable { public let metricId: String; public let value: String; public init(metricId: String, value: String) { self.metricId = metricId; self.value = value } }
public enum MetricUpdateOutput: Codable { case ok(metricId: String, value: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, metricId, value, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(metricId: try c.decode(String.self, forKey: .metricId), value: try c.decode(String.self, forKey: .value)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let metricId, let value): try c.encode("ok", forKey: .variant); try c.encode(metricId, forKey: .metricId); try c.encode(value, forKey: .value); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MetricSetThresholdInput: Codable { public let metricId: String; public let threshold: String; public init(metricId: String, threshold: String) { self.metricId = metricId; self.threshold = threshold } }
public enum MetricSetThresholdOutput: Codable { case ok(metricId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, metricId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(metricId: try c.decode(String.self, forKey: .metricId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let metricId): try c.encode("ok", forKey: .variant); try c.encode(metricId, forKey: .metricId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct MetricEvaluateInput: Codable { public let metricId: String; public init(metricId: String) { self.metricId = metricId } }
public enum MetricEvaluateOutput: Codable { case ok(metricId: String, value: String, meetsThreshold: Bool); case error(message: String); enum CodingKeys: String, CodingKey { case variant, metricId, value, meetsThreshold, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(metricId: try c.decode(String.self, forKey: .metricId), value: try c.decode(String.self, forKey: .value), meetsThreshold: try c.decode(Bool.self, forKey: .meetsThreshold)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let metricId, let value, let meetsThreshold): try c.encode("ok", forKey: .variant); try c.encode(metricId, forKey: .metricId); try c.encode(value, forKey: .value); try c.encode(meetsThreshold, forKey: .meetsThreshold); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Objective Types

public struct ObjectiveCreateInput: Codable { public let polityId: String; public let title: String; public let targetMetricId: String; public let targetValue: String; public init(polityId: String, title: String, targetMetricId: String, targetValue: String) { self.polityId = polityId; self.title = title; self.targetMetricId = targetMetricId; self.targetValue = targetValue } }
public enum ObjectiveCreateOutput: Codable { case ok(objectiveId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, objectiveId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(objectiveId: try c.decode(String.self, forKey: .objectiveId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let objectiveId): try c.encode("ok", forKey: .variant); try c.encode(objectiveId, forKey: .objectiveId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ObjectiveUpdateProgressInput: Codable { public let objectiveId: String; public let progress: String; public init(objectiveId: String, progress: String) { self.objectiveId = objectiveId; self.progress = progress } }
public enum ObjectiveUpdateProgressOutput: Codable { case ok(objectiveId: String, progress: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, objectiveId, progress, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(objectiveId: try c.decode(String.self, forKey: .objectiveId), progress: try c.decode(String.self, forKey: .progress)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let objectiveId, let progress): try c.encode("ok", forKey: .variant); try c.encode(objectiveId, forKey: .objectiveId); try c.encode(progress, forKey: .progress); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ObjectiveEvaluateInput: Codable { public let objectiveId: String; public init(objectiveId: String) { self.objectiveId = objectiveId } }
public enum ObjectiveEvaluateOutput: Codable { case ok(objectiveId: String, met: Bool, progress: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, objectiveId, met, progress, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(objectiveId: try c.decode(String.self, forKey: .objectiveId), met: try c.decode(Bool.self, forKey: .met), progress: try c.decode(String.self, forKey: .progress)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let objectiveId, let met, let progress): try c.encode("ok", forKey: .variant); try c.encode(objectiveId, forKey: .objectiveId); try c.encode(met, forKey: .met); try c.encode(progress, forKey: .progress); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct ObjectiveCancelInput: Codable { public let objectiveId: String; public let reason: String; public init(objectiveId: String, reason: String) { self.objectiveId = objectiveId; self.reason = reason } }
public enum ObjectiveCancelOutput: Codable { case ok(objectiveId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, objectiveId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(objectiveId: try c.decode(String.self, forKey: .objectiveId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let objectiveId): try c.encode("ok", forKey: .variant); try c.encode(objectiveId, forKey: .objectiveId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - BondingCurve Types

public struct BondingCurveCreateInput: Codable { public let name: String; public let formula: String; public let reserveAsset: String; public init(name: String, formula: String, reserveAsset: String) { self.name = name; self.formula = formula; self.reserveAsset = reserveAsset } }
public enum BondingCurveCreateOutput: Codable { case ok(curveId: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, curveId, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(curveId: try c.decode(String.self, forKey: .curveId)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let curveId): try c.encode("ok", forKey: .variant); try c.encode(curveId, forKey: .curveId); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct BondingCurveBuyInput: Codable { public let curveId: String; public let buyerId: String; public let amount: String; public init(curveId: String, buyerId: String, amount: String) { self.curveId = curveId; self.buyerId = buyerId; self.amount = amount } }
public enum BondingCurveBuyOutput: Codable { case ok(curveId: String, tokensMinted: String, newPrice: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, curveId, tokensMinted, newPrice, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(curveId: try c.decode(String.self, forKey: .curveId), tokensMinted: try c.decode(String.self, forKey: .tokensMinted), newPrice: try c.decode(String.self, forKey: .newPrice)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let curveId, let tokensMinted, let newPrice): try c.encode("ok", forKey: .variant); try c.encode(curveId, forKey: .curveId); try c.encode(tokensMinted, forKey: .tokensMinted); try c.encode(newPrice, forKey: .newPrice); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct BondingCurveSellInput: Codable { public let curveId: String; public let sellerId: String; public let tokenAmount: String; public init(curveId: String, sellerId: String, tokenAmount: String) { self.curveId = curveId; self.sellerId = sellerId; self.tokenAmount = tokenAmount } }
public enum BondingCurveSellOutput: Codable { case ok(curveId: String, reserveReturned: String, newPrice: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, curveId, reserveReturned, newPrice, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(curveId: try c.decode(String.self, forKey: .curveId), reserveReturned: try c.decode(String.self, forKey: .reserveReturned), newPrice: try c.decode(String.self, forKey: .newPrice)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let curveId, let reserveReturned, let newPrice): try c.encode("ok", forKey: .variant); try c.encode(curveId, forKey: .curveId); try c.encode(reserveReturned, forKey: .reserveReturned); try c.encode(newPrice, forKey: .newPrice); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct BondingCurveGetPriceInput: Codable { public let curveId: String; public init(curveId: String) { self.curveId = curveId } }
public enum BondingCurveGetPriceOutput: Codable { case ok(curveId: String, price: String, supply: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, curveId, price, supply, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "ok": self = .ok(curveId: try c.decode(String.self, forKey: .curveId), price: try c.decode(String.self, forKey: .price), supply: try c.decode(String.self, forKey: .supply)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .ok(let curveId, let price, let supply): try c.encode("ok", forKey: .variant); try c.encode(curveId, forKey: .curveId); try c.encode(price, forKey: .price); try c.encode(supply, forKey: .supply); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Handler Protocols

public protocol TreasuryHandler {
    func deposit(input: TreasuryDepositInput, storage: ConceptStorage) async throws -> TreasuryDepositOutput
    func withdraw(input: TreasuryWithdrawInput, storage: ConceptStorage) async throws -> TreasuryWithdrawOutput
    func allocate(input: TreasuryAllocateInput, storage: ConceptStorage) async throws -> TreasuryAllocateOutput
    func releaseAllocation(input: TreasuryReleaseAllocationInput, storage: ConceptStorage) async throws -> TreasuryReleaseAllocationOutput
}

public protocol ReputationHandler {
    func earn(input: ReputationEarnInput, storage: ConceptStorage) async throws -> ReputationEarnOutput
    func burn(input: ReputationBurnInput, storage: ConceptStorage) async throws -> ReputationBurnOutput
    func decay(input: ReputationDecayInput, storage: ConceptStorage) async throws -> ReputationDecayOutput
    func getScore(input: ReputationGetScoreInput, storage: ConceptStorage) async throws -> ReputationGetScoreOutput
    func recalculate(input: ReputationRecalculateInput, storage: ConceptStorage) async throws -> ReputationRecalculateOutput
}

public protocol MetricHandler {
    func define(input: MetricDefineInput, storage: ConceptStorage) async throws -> MetricDefineOutput
    func update(input: MetricUpdateInput, storage: ConceptStorage) async throws -> MetricUpdateOutput
    func setThreshold(input: MetricSetThresholdInput, storage: ConceptStorage) async throws -> MetricSetThresholdOutput
    func evaluate(input: MetricEvaluateInput, storage: ConceptStorage) async throws -> MetricEvaluateOutput
}

public protocol ObjectiveHandler {
    func create(input: ObjectiveCreateInput, storage: ConceptStorage) async throws -> ObjectiveCreateOutput
    func updateProgress(input: ObjectiveUpdateProgressInput, storage: ConceptStorage) async throws -> ObjectiveUpdateProgressOutput
    func evaluate(input: ObjectiveEvaluateInput, storage: ConceptStorage) async throws -> ObjectiveEvaluateOutput
    func cancel(input: ObjectiveCancelInput, storage: ConceptStorage) async throws -> ObjectiveCancelOutput
}

public protocol BondingCurveHandler {
    func create(input: BondingCurveCreateInput, storage: ConceptStorage) async throws -> BondingCurveCreateOutput
    func buy(input: BondingCurveBuyInput, storage: ConceptStorage) async throws -> BondingCurveBuyOutput
    func sell(input: BondingCurveSellInput, storage: ConceptStorage) async throws -> BondingCurveSellOutput
    func getPrice(input: BondingCurveGetPriceInput, storage: ConceptStorage) async throws -> BondingCurveGetPriceOutput
}

// MARK: - Stub Implementations

public struct TreasuryHandlerImpl: TreasuryHandler {
    public init() {}
    public func deposit(input: TreasuryDepositInput, storage: ConceptStorage) async throws -> TreasuryDepositOutput { /* TODO: implement handler */ return .ok(treasuryId: input.treasuryId, balance: input.amount) }
    public func withdraw(input: TreasuryWithdrawInput, storage: ConceptStorage) async throws -> TreasuryWithdrawOutput { /* TODO: implement handler */ return .ok(treasuryId: input.treasuryId, balance: "0") }
    public func allocate(input: TreasuryAllocateInput, storage: ConceptStorage) async throws -> TreasuryAllocateOutput { /* TODO: implement handler */ return .ok(allocationId: "alloc-stub") }
    public func releaseAllocation(input: TreasuryReleaseAllocationInput, storage: ConceptStorage) async throws -> TreasuryReleaseAllocationOutput { /* TODO: implement handler */ return .ok(allocationId: input.allocationId) }
}

public struct ReputationHandlerImpl: ReputationHandler {
    public init() {}
    public func earn(input: ReputationEarnInput, storage: ConceptStorage) async throws -> ReputationEarnOutput { /* TODO: implement handler */ return .ok(memberId: input.memberId, newScore: input.amount) }
    public func burn(input: ReputationBurnInput, storage: ConceptStorage) async throws -> ReputationBurnOutput { /* TODO: implement handler */ return .ok(memberId: input.memberId, newScore: "0") }
    public func decay(input: ReputationDecayInput, storage: ConceptStorage) async throws -> ReputationDecayOutput { /* TODO: implement handler */ return .ok(polityId: input.polityId, membersAffected: 0) }
    public func getScore(input: ReputationGetScoreInput, storage: ConceptStorage) async throws -> ReputationGetScoreOutput { /* TODO: implement handler */ return .ok(memberId: input.memberId, score: "0") }
    public func recalculate(input: ReputationRecalculateInput, storage: ConceptStorage) async throws -> ReputationRecalculateOutput { /* TODO: implement handler */ return .ok(memberId: input.memberId, newScore: "0") }
}

public struct MetricHandlerImpl: MetricHandler {
    public init() {}
    public func define(input: MetricDefineInput, storage: ConceptStorage) async throws -> MetricDefineOutput { /* TODO: implement handler */ return .ok(metricId: "metric-stub") }
    public func update(input: MetricUpdateInput, storage: ConceptStorage) async throws -> MetricUpdateOutput { /* TODO: implement handler */ return .ok(metricId: input.metricId, value: input.value) }
    public func setThreshold(input: MetricSetThresholdInput, storage: ConceptStorage) async throws -> MetricSetThresholdOutput { /* TODO: implement handler */ return .ok(metricId: input.metricId) }
    public func evaluate(input: MetricEvaluateInput, storage: ConceptStorage) async throws -> MetricEvaluateOutput { /* TODO: implement handler */ return .ok(metricId: input.metricId, value: "0", meetsThreshold: false) }
}

public struct ObjectiveHandlerImpl: ObjectiveHandler {
    public init() {}
    public func create(input: ObjectiveCreateInput, storage: ConceptStorage) async throws -> ObjectiveCreateOutput { /* TODO: implement handler */ return .ok(objectiveId: "obj-stub") }
    public func updateProgress(input: ObjectiveUpdateProgressInput, storage: ConceptStorage) async throws -> ObjectiveUpdateProgressOutput { /* TODO: implement handler */ return .ok(objectiveId: input.objectiveId, progress: input.progress) }
    public func evaluate(input: ObjectiveEvaluateInput, storage: ConceptStorage) async throws -> ObjectiveEvaluateOutput { /* TODO: implement handler */ return .ok(objectiveId: input.objectiveId, met: false, progress: "0") }
    public func cancel(input: ObjectiveCancelInput, storage: ConceptStorage) async throws -> ObjectiveCancelOutput { /* TODO: implement handler */ return .ok(objectiveId: input.objectiveId) }
}

public struct BondingCurveHandlerImpl: BondingCurveHandler {
    public init() {}
    public func create(input: BondingCurveCreateInput, storage: ConceptStorage) async throws -> BondingCurveCreateOutput { /* TODO: implement handler */ return .ok(curveId: "curve-stub") }
    public func buy(input: BondingCurveBuyInput, storage: ConceptStorage) async throws -> BondingCurveBuyOutput { /* TODO: implement handler */ return .ok(curveId: input.curveId, tokensMinted: "0", newPrice: "0") }
    public func sell(input: BondingCurveSellInput, storage: ConceptStorage) async throws -> BondingCurveSellOutput { /* TODO: implement handler */ return .ok(curveId: input.curveId, reserveReturned: "0", newPrice: "0") }
    public func getPrice(input: BondingCurveGetPriceInput, storage: ConceptStorage) async throws -> BondingCurveGetPriceOutput { /* TODO: implement handler */ return .ok(curveId: input.curveId, price: "0", supply: "0") }
}
