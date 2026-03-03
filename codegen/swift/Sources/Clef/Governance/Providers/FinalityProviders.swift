// FinalityProviders.swift — Governance Finality providers: ImmediateFinality, ChainFinality, BftFinality, OptimisticOracleFinality

import Foundation

// MARK: - ImmediateFinality Types

public struct ImmediateFinalityConfirmInput: Codable {
    public let operationRef: String
    public init(operationRef: String) { self.operationRef = operationRef }
}

public enum ImmediateFinalityConfirmOutput: Codable {
    case finalized(confirmation: String)
    case alreadyFinalized(confirmation: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, confirmation, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "finalized": self = .finalized(confirmation: try c.decode(String.self, forKey: .confirmation)); case "already_finalized": self = .alreadyFinalized(confirmation: try c.decode(String.self, forKey: .confirmation)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .finalized(let confirmation): try c.encode("finalized", forKey: .variant); try c.encode(confirmation, forKey: .confirmation); case .alreadyFinalized(let confirmation): try c.encode("already_finalized", forKey: .variant); try c.encode(confirmation, forKey: .confirmation); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - ChainFinality Types

public struct ChainFinalityTrackInput: Codable {
    public let operationRef: String
    public let txHash: String
    public let chainId: String
    public let requiredConfirmations: Int?
    public let submittedBlock: Int?
    public init(operationRef: String, txHash: String, chainId: String, requiredConfirmations: Int? = nil, submittedBlock: Int? = nil) { self.operationRef = operationRef; self.txHash = txHash; self.chainId = chainId; self.requiredConfirmations = requiredConfirmations; self.submittedBlock = submittedBlock }
}

public enum ChainFinalityTrackOutput: Codable {
    case tracking(entry: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, entry, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "tracking": self = .tracking(entry: try c.decode(String.self, forKey: .entry)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .tracking(let entry): try c.encode("tracking", forKey: .variant); try c.encode(entry, forKey: .entry); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ChainFinalityCheckInput: Codable {
    public let entry: String
    public let currentBlock: Int?
    public init(entry: String, currentBlock: Int? = nil) { self.entry = entry; self.currentBlock = currentBlock }
}

public enum ChainFinalityCheckOutput: Codable {
    case finalized(entry: String, currentConfirmations: Int, required: Int)
    case pending(entry: String, currentConfirmations: Int, required: Int)
    case notFound(entry: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, entry, currentConfirmations, required, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "finalized": self = .finalized(entry: try c.decode(String.self, forKey: .entry), currentConfirmations: try c.decode(Int.self, forKey: .currentConfirmations), required: try c.decode(Int.self, forKey: .required)); case "pending": self = .pending(entry: try c.decode(String.self, forKey: .entry), currentConfirmations: try c.decode(Int.self, forKey: .currentConfirmations), required: try c.decode(Int.self, forKey: .required)); case "not_found": self = .notFound(entry: try c.decode(String.self, forKey: .entry)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .finalized(let entry, let currentConfirmations, let required): try c.encode("finalized", forKey: .variant); try c.encode(entry, forKey: .entry); try c.encode(currentConfirmations, forKey: .currentConfirmations); try c.encode(required, forKey: .required); case .pending(let entry, let currentConfirmations, let required): try c.encode("pending", forKey: .variant); try c.encode(entry, forKey: .entry); try c.encode(currentConfirmations, forKey: .currentConfirmations); try c.encode(required, forKey: .required); case .notFound(let entry): try c.encode("not_found", forKey: .variant); try c.encode(entry, forKey: .entry); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - BftFinality Types

public struct BftFinalityConfigureCommitteeInput: Codable { public let validators: [String]; public let faultTolerance: String?; public let protocol_: String?; enum CodingKeys: String, CodingKey { case validators, faultTolerance, protocol_ = "protocol" }; public init(validators: [String], faultTolerance: String? = nil, protocol_: String? = nil) { self.validators = validators; self.faultTolerance = faultTolerance; self.protocol_ = protocol_ } }
public enum BftFinalityConfigureCommitteeOutput: Codable { case configured(committee: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, committee, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(committee: try c.decode(String.self, forKey: .committee)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let committee): try c.encode("configured", forKey: .variant); try c.encode(committee, forKey: .committee); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct BftFinalityProposeInput: Codable { public let committee: String; public let operationRef: String; public let proposer: String; public init(committee: String, operationRef: String, proposer: String) { self.committee = committee; self.operationRef = operationRef; self.proposer = proposer } }
public enum BftFinalityProposeOutput: Codable { case proposed(committee: String, roundNumber: Int); case notFound(committee: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, committee, roundNumber, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "proposed": self = .proposed(committee: try c.decode(String.self, forKey: .committee), roundNumber: try c.decode(Int.self, forKey: .roundNumber)); case "not_found": self = .notFound(committee: try c.decode(String.self, forKey: .committee)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .proposed(let committee, let roundNumber): try c.encode("proposed", forKey: .variant); try c.encode(committee, forKey: .committee); try c.encode(roundNumber, forKey: .roundNumber); case .notFound(let committee): try c.encode("not_found", forKey: .variant); try c.encode(committee, forKey: .committee); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct BftFinalityVoteInput: Codable { public let committee: String; public let roundNumber: Int; public let validator: String; public let approve: Bool; public init(committee: String, roundNumber: Int, validator: String, approve: Bool) { self.committee = committee; self.roundNumber = roundNumber; self.validator = validator; self.approve = approve } }
public enum BftFinalityVoteOutput: Codable { case voted(committee: String, roundNumber: Int, validator: String); case notAValidator(validator: String); case notFound(committee: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, committee, roundNumber, validator, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "voted": self = .voted(committee: try c.decode(String.self, forKey: .committee), roundNumber: try c.decode(Int.self, forKey: .roundNumber), validator: try c.decode(String.self, forKey: .validator)); case "not_a_validator": self = .notAValidator(validator: try c.decode(String.self, forKey: .validator)); case "not_found": self = .notFound(committee: try c.decode(String.self, forKey: .committee)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .voted(let committee, let roundNumber, let validator): try c.encode("voted", forKey: .variant); try c.encode(committee, forKey: .committee); try c.encode(roundNumber, forKey: .roundNumber); try c.encode(validator, forKey: .validator); case .notAValidator(let validator): try c.encode("not_a_validator", forKey: .variant); try c.encode(validator, forKey: .validator); case .notFound(let committee): try c.encode("not_found", forKey: .variant); try c.encode(committee, forKey: .committee); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct BftFinalityCheckConsensusInput: Codable { public let committee: String; public let roundNumber: Int; public init(committee: String, roundNumber: Int) { self.committee = committee; self.roundNumber = roundNumber } }
public enum BftFinalityCheckConsensusOutput: Codable { case finalized(committee: String, currentVotes: Int, required: Int); case rejected(committee: String, rejections: Int, required: Int); case insufficient(committee: String, currentVotes: Int, required: Int); case notFound(committee: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, committee, currentVotes, rejections, required, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "finalized": self = .finalized(committee: try c.decode(String.self, forKey: .committee), currentVotes: try c.decode(Int.self, forKey: .currentVotes), required: try c.decode(Int.self, forKey: .required)); case "rejected": self = .rejected(committee: try c.decode(String.self, forKey: .committee), rejections: try c.decode(Int.self, forKey: .rejections), required: try c.decode(Int.self, forKey: .required)); case "insufficient": self = .insufficient(committee: try c.decode(String.self, forKey: .committee), currentVotes: try c.decode(Int.self, forKey: .currentVotes), required: try c.decode(Int.self, forKey: .required)); case "not_found": self = .notFound(committee: try c.decode(String.self, forKey: .committee)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .finalized(let committee, let currentVotes, let required): try c.encode("finalized", forKey: .variant); try c.encode(committee, forKey: .committee); try c.encode(currentVotes, forKey: .currentVotes); try c.encode(required, forKey: .required); case .rejected(let committee, let rejections, let required): try c.encode("rejected", forKey: .variant); try c.encode(committee, forKey: .committee); try c.encode(rejections, forKey: .rejections); try c.encode(required, forKey: .required); case .insufficient(let committee, let currentVotes, let required): try c.encode("insufficient", forKey: .variant); try c.encode(committee, forKey: .committee); try c.encode(currentVotes, forKey: .currentVotes); try c.encode(required, forKey: .required); case .notFound(let committee): try c.encode("not_found", forKey: .variant); try c.encode(committee, forKey: .committee); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - OptimisticOracleFinality Types

public struct OptimisticOracleAssertInput: Codable { public let operationRef: String; public let asserter: String; public let bond: Double; public let challengeWindowHours: Double?; public init(operationRef: String, asserter: String, bond: Double, challengeWindowHours: Double? = nil) { self.operationRef = operationRef; self.asserter = asserter; self.bond = bond; self.challengeWindowHours = challengeWindowHours } }
public enum OptimisticOracleAssertOutput: Codable { case asserted(assertion: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, assertion, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "asserted": self = .asserted(assertion: try c.decode(String.self, forKey: .assertion)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .asserted(let assertion): try c.encode("asserted", forKey: .variant); try c.encode(assertion, forKey: .assertion); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct OptimisticOracleChallengeInput: Codable { public let assertion: String; public let challenger: String; public let bond: Double?; public init(assertion: String, challenger: String, bond: Double? = nil) { self.assertion = assertion; self.challenger = challenger; self.bond = bond } }
public enum OptimisticOracleChallengeOutput: Codable { case challenged(assertion: String); case notPending(assertion: String, status: String); case notFound(assertion: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, assertion, status, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "challenged": self = .challenged(assertion: try c.decode(String.self, forKey: .assertion)); case "not_pending": self = .notPending(assertion: try c.decode(String.self, forKey: .assertion), status: try c.decode(String.self, forKey: .status)); case "not_found": self = .notFound(assertion: try c.decode(String.self, forKey: .assertion)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .challenged(let assertion): try c.encode("challenged", forKey: .variant); try c.encode(assertion, forKey: .assertion); case .notPending(let assertion, let status): try c.encode("not_pending", forKey: .variant); try c.encode(assertion, forKey: .assertion); try c.encode(status, forKey: .status); case .notFound(let assertion): try c.encode("not_found", forKey: .variant); try c.encode(assertion, forKey: .assertion); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct OptimisticOracleResolveInput: Codable { public let assertion: String; public let validAssertion: Bool; public init(assertion: String, validAssertion: Bool) { self.assertion = assertion; self.validAssertion = validAssertion } }
public enum OptimisticOracleResolveOutput: Codable { case finalized(assertion: String, bondRecipient: String, totalBond: Double); case rejected(assertion: String, bondRecipient: String, totalBond: Double); case notFound(assertion: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, assertion, bondRecipient, totalBond, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "finalized": self = .finalized(assertion: try c.decode(String.self, forKey: .assertion), bondRecipient: try c.decode(String.self, forKey: .bondRecipient), totalBond: try c.decode(Double.self, forKey: .totalBond)); case "rejected": self = .rejected(assertion: try c.decode(String.self, forKey: .assertion), bondRecipient: try c.decode(String.self, forKey: .bondRecipient), totalBond: try c.decode(Double.self, forKey: .totalBond)); case "not_found": self = .notFound(assertion: try c.decode(String.self, forKey: .assertion)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .finalized(let assertion, let bondRecipient, let totalBond): try c.encode("finalized", forKey: .variant); try c.encode(assertion, forKey: .assertion); try c.encode(bondRecipient, forKey: .bondRecipient); try c.encode(totalBond, forKey: .totalBond); case .rejected(let assertion, let bondRecipient, let totalBond): try c.encode("rejected", forKey: .variant); try c.encode(assertion, forKey: .assertion); try c.encode(bondRecipient, forKey: .bondRecipient); try c.encode(totalBond, forKey: .totalBond); case .notFound(let assertion): try c.encode("not_found", forKey: .variant); try c.encode(assertion, forKey: .assertion); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct OptimisticOracleCheckExpiryInput: Codable { public let assertion: String; public init(assertion: String) { self.assertion = assertion } }
public enum OptimisticOracleCheckExpiryOutput: Codable { case finalized(assertion: String); case stillPending(assertion: String, remainingHours: Double); case notFound(assertion: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, assertion, remainingHours, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "finalized": self = .finalized(assertion: try c.decode(String.self, forKey: .assertion)); case "still_pending": self = .stillPending(assertion: try c.decode(String.self, forKey: .assertion), remainingHours: try c.decode(Double.self, forKey: .remainingHours)); case "not_found": self = .notFound(assertion: try c.decode(String.self, forKey: .assertion)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .finalized(let assertion): try c.encode("finalized", forKey: .variant); try c.encode(assertion, forKey: .assertion); case .stillPending(let assertion, let remainingHours): try c.encode("still_pending", forKey: .variant); try c.encode(assertion, forKey: .assertion); try c.encode(remainingHours, forKey: .remainingHours); case .notFound(let assertion): try c.encode("not_found", forKey: .variant); try c.encode(assertion, forKey: .assertion); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Handler Protocols

public protocol ImmediateFinalityHandler { func confirm(input: ImmediateFinalityConfirmInput, storage: ConceptStorage) async throws -> ImmediateFinalityConfirmOutput }
public protocol ChainFinalityHandler { func track(input: ChainFinalityTrackInput, storage: ConceptStorage) async throws -> ChainFinalityTrackOutput; func checkFinality(input: ChainFinalityCheckInput, storage: ConceptStorage) async throws -> ChainFinalityCheckOutput }
public protocol BftFinalityHandler { func configureCommittee(input: BftFinalityConfigureCommitteeInput, storage: ConceptStorage) async throws -> BftFinalityConfigureCommitteeOutput; func proposeFinality(input: BftFinalityProposeInput, storage: ConceptStorage) async throws -> BftFinalityProposeOutput; func vote(input: BftFinalityVoteInput, storage: ConceptStorage) async throws -> BftFinalityVoteOutput; func checkConsensus(input: BftFinalityCheckConsensusInput, storage: ConceptStorage) async throws -> BftFinalityCheckConsensusOutput }
public protocol OptimisticOracleFinalityHandler { func assertFinality(input: OptimisticOracleAssertInput, storage: ConceptStorage) async throws -> OptimisticOracleAssertOutput; func challenge(input: OptimisticOracleChallengeInput, storage: ConceptStorage) async throws -> OptimisticOracleChallengeOutput; func resolve(input: OptimisticOracleResolveInput, storage: ConceptStorage) async throws -> OptimisticOracleResolveOutput; func checkExpiry(input: OptimisticOracleCheckExpiryInput, storage: ConceptStorage) async throws -> OptimisticOracleCheckExpiryOutput }

// MARK: - Handler Implementations

public struct ImmediateFinalityHandlerImpl: ImmediateFinalityHandler {
    public init() {}
    public func confirm(input: ImmediateFinalityConfirmInput, storage: ConceptStorage) async throws -> ImmediateFinalityConfirmOutput {
        let existing = try await storage.find(relation: "imm_final", criteria: ["operationRef": input.operationRef])
        if let first = existing.first, let id = first["id"] as? String { return .alreadyFinalized(confirmation: id) }
        let id = "imm-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "imm_final", key: id, value: ["id": id, "operationRef": input.operationRef, "confirmedAt": ISO8601DateFormatter().string(from: Date())])
        try await storage.put(relation: "plugin-registry", key: "finality-provider:\(id)", value: ["id": "finality-provider:\(id)", "pluginKind": "finality-provider", "provider": "ImmediateFinality", "instanceId": id])
        return .finalized(confirmation: id)
    }
}

public struct ChainFinalityHandlerImpl: ChainFinalityHandler {
    public init() {}
    public func track(input: ChainFinalityTrackInput, storage: ConceptStorage) async throws -> ChainFinalityTrackOutput {
        let id = "chain-\(Int(Date().timeIntervalSince1970 * 1000))"
        let required = input.requiredConfirmations ?? 12
        try await storage.put(relation: "chain_final", key: id, value: ["id": id, "operationRef": input.operationRef, "txHash": input.txHash, "chainId": input.chainId, "requiredConfirmations": required, "status": "Pending", "submittedBlock": input.submittedBlock ?? 0])
        try await storage.put(relation: "plugin-registry", key: "finality-provider:\(id)", value: ["id": "finality-provider:\(id)", "pluginKind": "finality-provider", "provider": "ChainFinality", "instanceId": id])
        return .tracking(entry: id)
    }

    public func checkFinality(input: ChainFinalityCheckInput, storage: ConceptStorage) async throws -> ChainFinalityCheckOutput {
        guard let record = try await storage.get(relation: "chain_final", key: input.entry) else { return .notFound(entry: input.entry) }
        let required = (record["requiredConfirmations"] as? Int) ?? 12
        let submittedBlock = (record["submittedBlock"] as? Int) ?? 0
        let current = input.currentBlock ?? submittedBlock
        let confirmations = max(0, current - submittedBlock)
        if confirmations >= required {
            var updated = record; updated["status"] = "Finalized"
            try await storage.put(relation: "chain_final", key: input.entry, value: updated)
            return .finalized(entry: input.entry, currentConfirmations: confirmations, required: required)
        }
        return .pending(entry: input.entry, currentConfirmations: confirmations, required: required)
    }
}

public struct BftFinalityHandlerImpl: BftFinalityHandler {
    public init() {}
    public func configureCommittee(input: BftFinalityConfigureCommitteeInput, storage: ConceptStorage) async throws -> BftFinalityConfigureCommitteeOutput {
        let id = "bft-\(Int(Date().timeIntervalSince1970 * 1000))"
        let encoder = JSONEncoder()
        let validatorsJson = String(data: try encoder.encode(input.validators), encoding: .utf8) ?? "[]"
        try await storage.put(relation: "bft", key: id, value: ["id": id, "validators": validatorsJson, "validatorCount": input.validators.count, "faultTolerance": input.faultTolerance ?? "2/3", "protocol": input.protocol_ ?? "simple-bft"])
        try await storage.put(relation: "plugin-registry", key: "finality-provider:\(id)", value: ["id": "finality-provider:\(id)", "pluginKind": "finality-provider", "provider": "BftFinality", "instanceId": id])
        return .configured(committee: id)
    }

    public func proposeFinality(input: BftFinalityProposeInput, storage: ConceptStorage) async throws -> BftFinalityProposeOutput {
        guard let _ = try await storage.get(relation: "bft", key: input.committee) else { return .notFound(committee: input.committee) }
        let roundNumber = Int(Date().timeIntervalSince1970 * 1000)
        let roundKey = "\(input.committee):\(roundNumber)"
        try await storage.put(relation: "bft_round", key: roundKey, value: ["committee": input.committee, "roundNumber": roundNumber, "operationRef": input.operationRef, "proposer": input.proposer, "votes": "{}", "status": "proposed"])
        return .proposed(committee: input.committee, roundNumber: roundNumber)
    }

    public func vote(input: BftFinalityVoteInput, storage: ConceptStorage) async throws -> BftFinalityVoteOutput {
        let roundKey = "\(input.committee):\(input.roundNumber)"
        guard let round = try await storage.get(relation: "bft_round", key: roundKey) else { return .notFound(committee: input.committee) }
        guard let record = try await storage.get(relation: "bft", key: input.committee) else { return .notFound(committee: input.committee) }
        let validatorsStr = (record["validators"] as? String) ?? "[]"
        let validators = (try? JSONSerialization.jsonObject(with: validatorsStr.data(using: .utf8) ?? Data()) as? [String]) ?? []
        guard validators.contains(input.validator) else { return .notAValidator(validator: input.validator) }
        let votesStr = (round["votes"] as? String) ?? "{}"
        var votes = (try? JSONSerialization.jsonObject(with: votesStr.data(using: .utf8) ?? Data()) as? [String: Bool]) ?? [:]
        votes[input.validator] = input.approve
        var updated = round; updated["votes"] = String(data: try JSONSerialization.data(withJSONObject: votes), encoding: .utf8) ?? "{}"
        try await storage.put(relation: "bft_round", key: roundKey, value: updated)
        return .voted(committee: input.committee, roundNumber: input.roundNumber, validator: input.validator)
    }

    public func checkConsensus(input: BftFinalityCheckConsensusInput, storage: ConceptStorage) async throws -> BftFinalityCheckConsensusOutput {
        let roundKey = "\(input.committee):\(input.roundNumber)"
        guard let round = try await storage.get(relation: "bft_round", key: roundKey) else { return .notFound(committee: input.committee) }
        guard let record = try await storage.get(relation: "bft", key: input.committee) else { return .notFound(committee: input.committee) }
        let validatorCount = (record["validatorCount"] as? Int) ?? 0
        let required = Int(ceil(Double(validatorCount) * 2.0 / 3.0))
        let votesStr = (round["votes"] as? String) ?? "{}"
        let votes = (try? JSONSerialization.jsonObject(with: votesStr.data(using: .utf8) ?? Data()) as? [String: Bool]) ?? [:]
        let approvals = votes.values.filter { $0 }.count
        let rejections = votes.values.filter { !$0 }.count
        if approvals >= required {
            var updated = round; updated["status"] = "finalized"
            try await storage.put(relation: "bft_round", key: roundKey, value: updated)
            return .finalized(committee: input.committee, currentVotes: approvals, required: required)
        }
        if rejections > validatorCount - required {
            var updated = round; updated["status"] = "rejected"
            try await storage.put(relation: "bft_round", key: roundKey, value: updated)
            return .rejected(committee: input.committee, rejections: rejections, required: required)
        }
        return .insufficient(committee: input.committee, currentVotes: approvals, required: required)
    }
}

public struct OptimisticOracleFinalityHandlerImpl: OptimisticOracleFinalityHandler {
    public init() {}
    public func assertFinality(input: OptimisticOracleAssertInput, storage: ConceptStorage) async throws -> OptimisticOracleAssertOutput {
        let id = "oo-\(Int(Date().timeIntervalSince1970 * 1000))"
        let challengeWindowHours = input.challengeWindowHours ?? 24
        let expiresAt = ISO8601DateFormatter().string(from: Date().addingTimeInterval(challengeWindowHours * 3600))
        try await storage.put(relation: "oo_final", key: id, value: ["id": id, "operationRef": input.operationRef, "asserter": input.asserter, "bond": input.bond, "challengeWindowHours": challengeWindowHours, "expiresAt": expiresAt, "status": "Pending", "challenger": nil as String? as Any, "challengeBond": nil as Double? as Any])
        try await storage.put(relation: "plugin-registry", key: "finality-provider:\(id)", value: ["id": "finality-provider:\(id)", "pluginKind": "finality-provider", "provider": "OptimisticOracleFinality", "instanceId": id])
        return .asserted(assertion: id)
    }

    public func challenge(input: OptimisticOracleChallengeInput, storage: ConceptStorage) async throws -> OptimisticOracleChallengeOutput {
        guard let record = try await storage.get(relation: "oo_final", key: input.assertion) else { return .notFound(assertion: input.assertion) }
        guard (record["status"] as? String) == "Pending" else { return .notPending(assertion: input.assertion, status: (record["status"] as? String) ?? "") }
        var updated = record; updated["status"] = "Challenged"; updated["challenger"] = input.challenger; updated["challengeBond"] = input.bond ?? (record["bond"] as? Double) ?? 0; updated["challengedAt"] = ISO8601DateFormatter().string(from: Date())
        try await storage.put(relation: "oo_final", key: input.assertion, value: updated)
        return .challenged(assertion: input.assertion)
    }

    public func resolve(input: OptimisticOracleResolveInput, storage: ConceptStorage) async throws -> OptimisticOracleResolveOutput {
        guard let record = try await storage.get(relation: "oo_final", key: input.assertion) else { return .notFound(assertion: input.assertion) }
        let bond = (record["bond"] as? Double) ?? 0; let challengeBond = (record["challengeBond"] as? Double) ?? 0
        let totalBond = bond + challengeBond
        if input.validAssertion {
            var updated = record; updated["status"] = "Finalized"; updated["resolvedAt"] = ISO8601DateFormatter().string(from: Date()); updated["bondRecipient"] = record["asserter"]
            try await storage.put(relation: "oo_final", key: input.assertion, value: updated)
            return .finalized(assertion: input.assertion, bondRecipient: (record["asserter"] as? String) ?? "", totalBond: totalBond)
        }
        var updated = record; updated["status"] = "Rejected"; updated["resolvedAt"] = ISO8601DateFormatter().string(from: Date()); updated["bondRecipient"] = record["challenger"]
        try await storage.put(relation: "oo_final", key: input.assertion, value: updated)
        return .rejected(assertion: input.assertion, bondRecipient: (record["challenger"] as? String) ?? "", totalBond: totalBond)
    }

    public func checkExpiry(input: OptimisticOracleCheckExpiryInput, storage: ConceptStorage) async throws -> OptimisticOracleCheckExpiryOutput {
        guard var record = try await storage.get(relation: "oo_final", key: input.assertion) else { return .notFound(assertion: input.assertion) }
        guard (record["status"] as? String) == "Pending" else { return .finalized(assertion: input.assertion) }
        guard let expiresStr = record["expiresAt"] as? String, let expiresAt = ISO8601DateFormatter().date(from: expiresStr) else { return .notFound(assertion: input.assertion) }
        if Date() >= expiresAt {
            record["status"] = "Finalized"; record["resolvedAt"] = ISO8601DateFormatter().string(from: Date())
            try await storage.put(relation: "oo_final", key: input.assertion, value: record)
            return .finalized(assertion: input.assertion)
        }
        let remainingHours = expiresAt.timeIntervalSince(Date()) / 3600
        return .stillPending(assertion: input.assertion, remainingHours: remainingHours)
    }
}
