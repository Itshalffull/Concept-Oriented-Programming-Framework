// SybilProviders.swift — Governance Sybil Resistance providers: ProofOfPersonhood, StakeThreshold, SocialGraphVerification, AttestationSybil

import Foundation

// MARK: - ProofOfPersonhood Types

public struct ProofOfPersonhoodRequestInput: Codable {
    public let candidate: String
    public let method: String
    public let expiryDays: Int?
    public init(candidate: String, method: String, expiryDays: Int? = nil) { self.candidate = candidate; self.method = method; self.expiryDays = expiryDays }
}

public enum ProofOfPersonhoodRequestOutput: Codable {
    case verificationRequested(verification: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, verification, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "verification_requested": self = .verificationRequested(verification: try c.decode(String.self, forKey: .verification)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .verificationRequested(let verification): try c.encode("verification_requested", forKey: .variant); try c.encode(verification, forKey: .verification); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ProofOfPersonhoodConfirmInput: Codable {
    public let verification: String
    public init(verification: String) { self.verification = verification }
}

public enum ProofOfPersonhoodConfirmOutput: Codable {
    case verified(verification: String, candidate: String)
    case alreadyVerified(verification: String)
    case notFound(verification: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, verification, candidate, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "verified": self = .verified(verification: try c.decode(String.self, forKey: .verification), candidate: try c.decode(String.self, forKey: .candidate)); case "already_verified": self = .alreadyVerified(verification: try c.decode(String.self, forKey: .verification)); case "not_found": self = .notFound(verification: try c.decode(String.self, forKey: .verification)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .verified(let verification, let candidate): try c.encode("verified", forKey: .variant); try c.encode(verification, forKey: .verification); try c.encode(candidate, forKey: .candidate); case .alreadyVerified(let verification): try c.encode("already_verified", forKey: .variant); try c.encode(verification, forKey: .verification); case .notFound(let verification): try c.encode("not_found", forKey: .variant); try c.encode(verification, forKey: .verification); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ProofOfPersonhoodRejectInput: Codable {
    public let verification: String
    public let reason: String
    public init(verification: String, reason: String) { self.verification = verification; self.reason = reason }
}

public enum ProofOfPersonhoodRejectOutput: Codable {
    case rejected(verification: String, reason: String)
    case notFound(verification: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, verification, reason, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "rejected": self = .rejected(verification: try c.decode(String.self, forKey: .verification), reason: try c.decode(String.self, forKey: .reason)); case "not_found": self = .notFound(verification: try c.decode(String.self, forKey: .verification)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .rejected(let verification, let reason): try c.encode("rejected", forKey: .variant); try c.encode(verification, forKey: .verification); try c.encode(reason, forKey: .reason); case .notFound(let verification): try c.encode("not_found", forKey: .variant); try c.encode(verification, forKey: .verification); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

public struct ProofOfPersonhoodCheckStatusInput: Codable {
    public let verification: String
    public init(verification: String) { self.verification = verification }
}

public enum ProofOfPersonhoodCheckStatusOutput: Codable {
    case pending(verification: String, candidate: String)
    case verified(verification: String, candidate: String)
    case rejected(verification: String, candidate: String)
    case expired(verification: String, candidate: String)
    case notFound(verification: String)
    case error(message: String)
    enum CodingKeys: String, CodingKey { case variant, verification, candidate, message }
    public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "Pending": self = .pending(verification: try c.decode(String.self, forKey: .verification), candidate: try c.decode(String.self, forKey: .candidate)); case "Verified": self = .verified(verification: try c.decode(String.self, forKey: .verification), candidate: try c.decode(String.self, forKey: .candidate)); case "Rejected": self = .rejected(verification: try c.decode(String.self, forKey: .verification), candidate: try c.decode(String.self, forKey: .candidate)); case "expired": self = .expired(verification: try c.decode(String.self, forKey: .verification), candidate: try c.decode(String.self, forKey: .candidate)); case "not_found": self = .notFound(verification: try c.decode(String.self, forKey: .verification)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }
    public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .pending(let verification, let candidate): try c.encode("Pending", forKey: .variant); try c.encode(verification, forKey: .verification); try c.encode(candidate, forKey: .candidate); case .verified(let verification, let candidate): try c.encode("Verified", forKey: .variant); try c.encode(verification, forKey: .verification); try c.encode(candidate, forKey: .candidate); case .rejected(let verification, let candidate): try c.encode("Rejected", forKey: .variant); try c.encode(verification, forKey: .verification); try c.encode(candidate, forKey: .candidate); case .expired(let verification, let candidate): try c.encode("expired", forKey: .variant); try c.encode(verification, forKey: .verification); try c.encode(candidate, forKey: .candidate); case .notFound(let verification): try c.encode("not_found", forKey: .variant); try c.encode(verification, forKey: .verification); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } }
}

// MARK: - StakeThreshold Types

public struct StakeThresholdConfigureInput: Codable { public let minimumStake: Double; public let token: String; public let lockPeriodDays: Int?; public init(minimumStake: Double, token: String, lockPeriodDays: Int? = nil) { self.minimumStake = minimumStake; self.token = token; self.lockPeriodDays = lockPeriodDays } }
public enum StakeThresholdConfigureOutput: Codable { case configured(config: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, config, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct StakeThresholdDepositInput: Codable { public let config: String; public let candidate: String; public let amount: Double; public init(config: String, candidate: String, amount: Double) { self.config = config; self.candidate = candidate; self.amount = amount } }
public enum StakeThresholdDepositOutput: Codable { case deposited(candidate: String, balance: Double); case error(message: String); enum CodingKeys: String, CodingKey { case variant, candidate, balance, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "deposited": self = .deposited(candidate: try c.decode(String.self, forKey: .candidate), balance: try c.decode(Double.self, forKey: .balance)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .deposited(let candidate, let balance): try c.encode("deposited", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(balance, forKey: .balance); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct StakeThresholdCheckInput: Codable { public let config: String; public let candidate: String; public init(config: String, candidate: String) { self.config = config; self.candidate = candidate } }
public enum StakeThresholdCheckOutput: Codable { case qualified(candidate: String, balance: Double, minimumStake: Double); case insufficient(candidate: String, balance: Double, minimumStake: Double, shortfall: Double); case notFound(config: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, candidate, balance, minimumStake, shortfall, config, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "qualified": self = .qualified(candidate: try c.decode(String.self, forKey: .candidate), balance: try c.decode(Double.self, forKey: .balance), minimumStake: try c.decode(Double.self, forKey: .minimumStake)); case "insufficient": self = .insufficient(candidate: try c.decode(String.self, forKey: .candidate), balance: try c.decode(Double.self, forKey: .balance), minimumStake: try c.decode(Double.self, forKey: .minimumStake), shortfall: try c.decode(Double.self, forKey: .shortfall)); case "not_found": self = .notFound(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .qualified(let candidate, let balance, let minimumStake): try c.encode("qualified", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(balance, forKey: .balance); try c.encode(minimumStake, forKey: .minimumStake); case .insufficient(let candidate, let balance, let minimumStake, let shortfall): try c.encode("insufficient", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(balance, forKey: .balance); try c.encode(minimumStake, forKey: .minimumStake); try c.encode(shortfall, forKey: .shortfall); case .notFound(let config): try c.encode("not_found", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct StakeThresholdSlashInput: Codable { public let config: String; public let candidate: String; public let amount: Double; public init(config: String, candidate: String, amount: Double) { self.config = config; self.candidate = candidate; self.amount = amount } }
public enum StakeThresholdSlashOutput: Codable { case slashed(candidate: String, slashedAmount: Double, remainingBalance: Double); case noBalance(candidate: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, candidate, slashedAmount, remainingBalance, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "slashed": self = .slashed(candidate: try c.decode(String.self, forKey: .candidate), slashedAmount: try c.decode(Double.self, forKey: .slashedAmount), remainingBalance: try c.decode(Double.self, forKey: .remainingBalance)); case "no_balance": self = .noBalance(candidate: try c.decode(String.self, forKey: .candidate)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .slashed(let candidate, let slashedAmount, let remainingBalance): try c.encode("slashed", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(slashedAmount, forKey: .slashedAmount); try c.encode(remainingBalance, forKey: .remainingBalance); case .noBalance(let candidate): try c.encode("no_balance", forKey: .variant); try c.encode(candidate, forKey: .candidate); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - SocialGraphVerification Types

public struct SocialGraphConfigureInput: Codable { public let minimumVouchers: Int?; public let trustAlgorithm: String?; public init(minimumVouchers: Int? = nil, trustAlgorithm: String? = nil) { self.minimumVouchers = minimumVouchers; self.trustAlgorithm = trustAlgorithm } }
public enum SocialGraphConfigureOutput: Codable { case configured(config: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, config, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct SocialGraphVouchInput: Codable { public let config: String; public let voucher: String; public let candidate: String; public init(config: String, voucher: String, candidate: String) { self.config = config; self.voucher = voucher; self.candidate = candidate } }
public enum SocialGraphVouchOutput: Codable { case vouched(voucher: String, candidate: String); case selfVouch(voucher: String); case alreadyVouched(voucher: String, candidate: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, voucher, candidate, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "vouched": self = .vouched(voucher: try c.decode(String.self, forKey: .voucher), candidate: try c.decode(String.self, forKey: .candidate)); case "self_vouch": self = .selfVouch(voucher: try c.decode(String.self, forKey: .voucher)); case "already_vouched": self = .alreadyVouched(voucher: try c.decode(String.self, forKey: .voucher), candidate: try c.decode(String.self, forKey: .candidate)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .vouched(let voucher, let candidate): try c.encode("vouched", forKey: .variant); try c.encode(voucher, forKey: .voucher); try c.encode(candidate, forKey: .candidate); case .selfVouch(let voucher): try c.encode("self_vouch", forKey: .variant); try c.encode(voucher, forKey: .voucher); case .alreadyVouched(let voucher, let candidate): try c.encode("already_vouched", forKey: .variant); try c.encode(voucher, forKey: .voucher); try c.encode(candidate, forKey: .candidate); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct SocialGraphRevokeInput: Codable { public let config: String; public let voucher: String; public let candidate: String; public init(config: String, voucher: String, candidate: String) { self.config = config; self.voucher = voucher; self.candidate = candidate } }
public enum SocialGraphRevokeOutput: Codable { case revoked(voucher: String, candidate: String); case notFound(voucher: String, candidate: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, voucher, candidate, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "revoked": self = .revoked(voucher: try c.decode(String.self, forKey: .voucher), candidate: try c.decode(String.self, forKey: .candidate)); case "not_found": self = .notFound(voucher: try c.decode(String.self, forKey: .voucher), candidate: try c.decode(String.self, forKey: .candidate)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .revoked(let voucher, let candidate): try c.encode("revoked", forKey: .variant); try c.encode(voucher, forKey: .voucher); try c.encode(candidate, forKey: .candidate); case .notFound(let voucher, let candidate): try c.encode("not_found", forKey: .variant); try c.encode(voucher, forKey: .voucher); try c.encode(candidate, forKey: .candidate); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct SocialGraphVerifyInput: Codable { public let config: String; public let candidate: String; public init(config: String, candidate: String) { self.config = config; self.candidate = candidate } }
public enum SocialGraphVerifyOutput: Codable { case verified(candidate: String, voucherCount: Int, trustScore: Double); case insufficient(candidate: String, voucherCount: Int, required: Int, trustScore: Double); case error(message: String); enum CodingKeys: String, CodingKey { case variant, candidate, voucherCount, trustScore, required, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "verified": self = .verified(candidate: try c.decode(String.self, forKey: .candidate), voucherCount: try c.decode(Int.self, forKey: .voucherCount), trustScore: try c.decode(Double.self, forKey: .trustScore)); case "insufficient": self = .insufficient(candidate: try c.decode(String.self, forKey: .candidate), voucherCount: try c.decode(Int.self, forKey: .voucherCount), required: try c.decode(Int.self, forKey: .required), trustScore: try c.decode(Double.self, forKey: .trustScore)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .verified(let candidate, let voucherCount, let trustScore): try c.encode("verified", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(voucherCount, forKey: .voucherCount); try c.encode(trustScore, forKey: .trustScore); case .insufficient(let candidate, let voucherCount, let required, let trustScore): try c.encode("insufficient", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(voucherCount, forKey: .voucherCount); try c.encode(required, forKey: .required); try c.encode(trustScore, forKey: .trustScore); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - AttestationSybil Types

public struct AttestationSybilConfigureInput: Codable { public let requiredSchema: String; public let requiredAttester: String?; public init(requiredSchema: String, requiredAttester: String? = nil) { self.requiredSchema = requiredSchema; self.requiredAttester = requiredAttester } }
public enum AttestationSybilConfigureOutput: Codable { case configured(config: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, config, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "configured": self = .configured(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .configured(let config): try c.encode("configured", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct AttestationSybilSubmitInput: Codable { public let config: String; public let candidate: String; public let attestationRef: String; public let schema: String; public let attester: String; public let expiresAt: String?; public init(config: String, candidate: String, attestationRef: String, schema: String, attester: String, expiresAt: String? = nil) { self.config = config; self.candidate = candidate; self.attestationRef = attestationRef; self.schema = schema; self.attester = attester; self.expiresAt = expiresAt } }
public enum AttestationSybilSubmitOutput: Codable { case submitted(candidate: String, attestationRef: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, candidate, attestationRef, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "submitted": self = .submitted(candidate: try c.decode(String.self, forKey: .candidate), attestationRef: try c.decode(String.self, forKey: .attestationRef)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .submitted(let candidate, let attestationRef): try c.encode("submitted", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(attestationRef, forKey: .attestationRef); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

public struct AttestationSybilVerifyInput: Codable { public let config: String; public let candidate: String; public init(config: String, candidate: String) { self.config = config; self.candidate = candidate } }
public enum AttestationSybilVerifyOutput: Codable { case verified(candidate: String, attestationRef: String); case noAttestation(candidate: String); case schemaMismatch(candidate: String, expected: String, actual: String); case attesterMismatch(candidate: String, expected: String, actual: String); case expired(candidate: String, expiresAt: String); case notFound(config: String); case error(message: String); enum CodingKeys: String, CodingKey { case variant, candidate, attestationRef, expected, actual, expiresAt, config, message }; public init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); let v = try c.decode(String.self, forKey: .variant); switch v { case "verified": self = .verified(candidate: try c.decode(String.self, forKey: .candidate), attestationRef: try c.decode(String.self, forKey: .attestationRef)); case "no_attestation": self = .noAttestation(candidate: try c.decode(String.self, forKey: .candidate)); case "schema_mismatch": self = .schemaMismatch(candidate: try c.decode(String.self, forKey: .candidate), expected: try c.decode(String.self, forKey: .expected), actual: try c.decode(String.self, forKey: .actual)); case "attester_mismatch": self = .attesterMismatch(candidate: try c.decode(String.self, forKey: .candidate), expected: try c.decode(String.self, forKey: .expected), actual: try c.decode(String.self, forKey: .actual)); case "expired": self = .expired(candidate: try c.decode(String.self, forKey: .candidate), expiresAt: try c.decode(String.self, forKey: .expiresAt)); case "not_found": self = .notFound(config: try c.decode(String.self, forKey: .config)); case "error": self = .error(message: try c.decode(String.self, forKey: .message)); default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(v)")) } }; public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); switch self { case .verified(let candidate, let attestationRef): try c.encode("verified", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(attestationRef, forKey: .attestationRef); case .noAttestation(let candidate): try c.encode("no_attestation", forKey: .variant); try c.encode(candidate, forKey: .candidate); case .schemaMismatch(let candidate, let expected, let actual): try c.encode("schema_mismatch", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(expected, forKey: .expected); try c.encode(actual, forKey: .actual); case .attesterMismatch(let candidate, let expected, let actual): try c.encode("attester_mismatch", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(expected, forKey: .expected); try c.encode(actual, forKey: .actual); case .expired(let candidate, let expiresAt): try c.encode("expired", forKey: .variant); try c.encode(candidate, forKey: .candidate); try c.encode(expiresAt, forKey: .expiresAt); case .notFound(let config): try c.encode("not_found", forKey: .variant); try c.encode(config, forKey: .config); case .error(let message): try c.encode("error", forKey: .variant); try c.encode(message, forKey: .message) } } }

// MARK: - Handler Protocols

public protocol ProofOfPersonhoodHandler {
    func requestVerification(input: ProofOfPersonhoodRequestInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodRequestOutput
    func confirmVerification(input: ProofOfPersonhoodConfirmInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodConfirmOutput
    func rejectVerification(input: ProofOfPersonhoodRejectInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodRejectOutput
    func checkStatus(input: ProofOfPersonhoodCheckStatusInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodCheckStatusOutput
}

public protocol StakeThresholdHandler {
    func configure(input: StakeThresholdConfigureInput, storage: ConceptStorage) async throws -> StakeThresholdConfigureOutput
    func deposit(input: StakeThresholdDepositInput, storage: ConceptStorage) async throws -> StakeThresholdDepositOutput
    func check(input: StakeThresholdCheckInput, storage: ConceptStorage) async throws -> StakeThresholdCheckOutput
    func slash(input: StakeThresholdSlashInput, storage: ConceptStorage) async throws -> StakeThresholdSlashOutput
}

public protocol SocialGraphVerificationHandler {
    func configure(input: SocialGraphConfigureInput, storage: ConceptStorage) async throws -> SocialGraphConfigureOutput
    func addVouch(input: SocialGraphVouchInput, storage: ConceptStorage) async throws -> SocialGraphVouchOutput
    func revokeVouch(input: SocialGraphRevokeInput, storage: ConceptStorage) async throws -> SocialGraphRevokeOutput
    func verify(input: SocialGraphVerifyInput, storage: ConceptStorage) async throws -> SocialGraphVerifyOutput
}

public protocol AttestationSybilHandler {
    func configure(input: AttestationSybilConfigureInput, storage: ConceptStorage) async throws -> AttestationSybilConfigureOutput
    func submitAttestation(input: AttestationSybilSubmitInput, storage: ConceptStorage) async throws -> AttestationSybilSubmitOutput
    func verify(input: AttestationSybilVerifyInput, storage: ConceptStorage) async throws -> AttestationSybilVerifyOutput
}

// MARK: - Handler Implementations

public struct ProofOfPersonhoodHandlerImpl: ProofOfPersonhoodHandler {
    public init() {}

    public func requestVerification(input: ProofOfPersonhoodRequestInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodRequestOutput {
        let id = "pop-\(Int(Date().timeIntervalSince1970 * 1000))"
        let expiresAt: String? = input.expiryDays.map { ISO8601DateFormatter().string(from: Date().addingTimeInterval(Double($0) * 86400)) }
        try await storage.put(relation: "pop", key: id, value: [
            "id": id, "candidate": input.candidate, "method": input.method,
            "status": "Pending", "expiresAt": expiresAt as Any,
            "requestedAt": ISO8601DateFormatter().string(from: Date()),
        ])
        try await storage.put(relation: "plugin-registry", key: "sybil-method:\(id)", value: [
            "id": "sybil-method:\(id)", "pluginKind": "sybil-method",
            "provider": "ProofOfPersonhood", "instanceId": id,
        ])
        return .verificationRequested(verification: id)
    }

    public func confirmVerification(input: ProofOfPersonhoodConfirmInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodConfirmOutput {
        guard let record = try await storage.get(relation: "pop", key: input.verification) else { return .notFound(verification: input.verification) }
        if (record["status"] as? String) == "Verified" { return .alreadyVerified(verification: input.verification) }
        var updated = record; updated["status"] = "Verified"; updated["confirmedAt"] = ISO8601DateFormatter().string(from: Date())
        try await storage.put(relation: "pop", key: input.verification, value: updated)
        return .verified(verification: input.verification, candidate: (record["candidate"] as? String) ?? "")
    }

    public func rejectVerification(input: ProofOfPersonhoodRejectInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodRejectOutput {
        guard let record = try await storage.get(relation: "pop", key: input.verification) else { return .notFound(verification: input.verification) }
        var updated = record; updated["status"] = "Rejected"; updated["rejectedAt"] = ISO8601DateFormatter().string(from: Date()); updated["rejectionReason"] = input.reason
        try await storage.put(relation: "pop", key: input.verification, value: updated)
        return .rejected(verification: input.verification, reason: input.reason)
    }

    public func checkStatus(input: ProofOfPersonhoodCheckStatusInput, storage: ConceptStorage) async throws -> ProofOfPersonhoodCheckStatusOutput {
        guard var record = try await storage.get(relation: "pop", key: input.verification) else { return .notFound(verification: input.verification) }
        let candidate = (record["candidate"] as? String) ?? ""
        if let expiresStr = record["expiresAt"] as? String, (record["status"] as? String) == "Verified",
           let expires = ISO8601DateFormatter().date(from: expiresStr), Date() > expires {
            record["status"] = "Expired"
            try await storage.put(relation: "pop", key: input.verification, value: record)
            return .expired(verification: input.verification, candidate: candidate)
        }
        switch (record["status"] as? String) ?? "Pending" {
        case "Verified": return .verified(verification: input.verification, candidate: candidate)
        case "Rejected": return .rejected(verification: input.verification, candidate: candidate)
        default: return .pending(verification: input.verification, candidate: candidate)
        }
    }
}

public struct StakeThresholdHandlerImpl: StakeThresholdHandler {
    public init() {}

    public func configure(input: StakeThresholdConfigureInput, storage: ConceptStorage) async throws -> StakeThresholdConfigureOutput {
        let id = "stake-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "stake_cfg", key: id, value: [
            "id": id, "minimumStake": input.minimumStake, "token": input.token, "lockPeriodDays": input.lockPeriodDays ?? 0,
        ])
        try await storage.put(relation: "plugin-registry", key: "sybil-method:\(id)", value: [
            "id": "sybil-method:\(id)", "pluginKind": "sybil-method", "provider": "StakeThreshold", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func deposit(input: StakeThresholdDepositInput, storage: ConceptStorage) async throws -> StakeThresholdDepositOutput {
        let key = "\(input.config):\(input.candidate)"
        let existing = try await storage.get(relation: "stake_balance", key: key)
        let currentBalance = (existing?["balance"] as? Double) ?? 0
        let newBalance = currentBalance + input.amount
        try await storage.put(relation: "stake_balance", key: key, value: [
            "config": input.config, "candidate": input.candidate, "balance": newBalance,
            "lastDepositAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .deposited(candidate: input.candidate, balance: newBalance)
    }

    public func check(input: StakeThresholdCheckInput, storage: ConceptStorage) async throws -> StakeThresholdCheckOutput {
        guard let cfg = try await storage.get(relation: "stake_cfg", key: input.config) else { return .notFound(config: input.config) }
        let minimumStake = (cfg["minimumStake"] as? Double) ?? 0
        let key = "\(input.config):\(input.candidate)"
        let balanceRecord = try await storage.get(relation: "stake_balance", key: key)
        let balance = (balanceRecord?["balance"] as? Double) ?? 0
        if balance >= minimumStake { return .qualified(candidate: input.candidate, balance: balance, minimumStake: minimumStake) }
        return .insufficient(candidate: input.candidate, balance: balance, minimumStake: minimumStake, shortfall: minimumStake - balance)
    }

    public func slash(input: StakeThresholdSlashInput, storage: ConceptStorage) async throws -> StakeThresholdSlashOutput {
        let key = "\(input.config):\(input.candidate)"
        guard let existing = try await storage.get(relation: "stake_balance", key: key) else { return .noBalance(candidate: input.candidate) }
        let currentBalance = (existing["balance"] as? Double) ?? 0
        let slashAmount = min(input.amount, currentBalance)
        let newBalance = currentBalance - slashAmount
        var updated = existing; updated["balance"] = newBalance
        try await storage.put(relation: "stake_balance", key: key, value: updated)
        return .slashed(candidate: input.candidate, slashedAmount: slashAmount, remainingBalance: newBalance)
    }
}

public struct SocialGraphVerificationHandlerImpl: SocialGraphVerificationHandler {
    public init() {}

    public func configure(input: SocialGraphConfigureInput, storage: ConceptStorage) async throws -> SocialGraphConfigureOutput {
        let id = "sg-cfg-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "sg_cfg", key: id, value: [
            "id": id, "minimumVouchers": input.minimumVouchers ?? 3, "trustAlgorithm": input.trustAlgorithm ?? "count",
        ])
        try await storage.put(relation: "plugin-registry", key: "sybil-method:\(id)", value: [
            "id": "sybil-method:\(id)", "pluginKind": "sybil-method", "provider": "SocialGraphVerification", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func addVouch(input: SocialGraphVouchInput, storage: ConceptStorage) async throws -> SocialGraphVouchOutput {
        if input.voucher == input.candidate { return .selfVouch(voucher: input.voucher) }
        let edgeKey = "\(input.config):\(input.voucher):\(input.candidate)"
        if let _ = try await storage.get(relation: "sg_vouch", key: edgeKey) { return .alreadyVouched(voucher: input.voucher, candidate: input.candidate) }
        try await storage.put(relation: "sg_vouch", key: edgeKey, value: [
            "config": input.config, "voucher": input.voucher, "candidate": input.candidate,
            "vouchedAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .vouched(voucher: input.voucher, candidate: input.candidate)
    }

    public func revokeVouch(input: SocialGraphRevokeInput, storage: ConceptStorage) async throws -> SocialGraphRevokeOutput {
        let edgeKey = "\(input.config):\(input.voucher):\(input.candidate)"
        guard let _ = try await storage.get(relation: "sg_vouch", key: edgeKey) else { return .notFound(voucher: input.voucher, candidate: input.candidate) }
        try await storage.del(relation: "sg_vouch", key: edgeKey)
        return .revoked(voucher: input.voucher, candidate: input.candidate)
    }

    public func verify(input: SocialGraphVerifyInput, storage: ConceptStorage) async throws -> SocialGraphVerifyOutput {
        let cfg = try await storage.get(relation: "sg_cfg", key: input.config)
        let minimumVouchers = (cfg?["minimumVouchers"] as? Int) ?? 3
        let algorithm = (cfg?["trustAlgorithm"] as? String) ?? "count"
        let vouches = try await storage.find(relation: "sg_vouch", criteria: ["config": input.config, "candidate": input.candidate])
        let voucherCount = vouches.count
        let trustScore: Double
        if algorithm == "count" { trustScore = Double(voucherCount) / Double(minimumVouchers) }
        else { trustScore = min(1.0, Double(voucherCount) / Double(minimumVouchers)) }
        if voucherCount >= minimumVouchers { return .verified(candidate: input.candidate, voucherCount: voucherCount, trustScore: trustScore) }
        return .insufficient(candidate: input.candidate, voucherCount: voucherCount, required: minimumVouchers, trustScore: trustScore)
    }
}

public struct AttestationSybilHandlerImpl: AttestationSybilHandler {
    public init() {}

    public func configure(input: AttestationSybilConfigureInput, storage: ConceptStorage) async throws -> AttestationSybilConfigureOutput {
        let id = "att-sybil-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await storage.put(relation: "att_sybil", key: id, value: [
            "id": id, "requiredSchema": input.requiredSchema, "requiredAttester": input.requiredAttester as Any,
        ])
        try await storage.put(relation: "plugin-registry", key: "sybil-method:\(id)", value: [
            "id": "sybil-method:\(id)", "pluginKind": "sybil-method", "provider": "AttestationSybil", "instanceId": id,
        ])
        return .configured(config: id)
    }

    public func submitAttestation(input: AttestationSybilSubmitInput, storage: ConceptStorage) async throws -> AttestationSybilSubmitOutput {
        let key = "\(input.config):\(input.candidate)"
        try await storage.put(relation: "att_sybil_credential", key: key, value: [
            "config": input.config, "candidate": input.candidate, "attestationRef": input.attestationRef,
            "schema": input.schema, "attester": input.attester, "expiresAt": input.expiresAt as Any,
            "submittedAt": ISO8601DateFormatter().string(from: Date()),
        ])
        return .submitted(candidate: input.candidate, attestationRef: input.attestationRef)
    }

    public func verify(input: AttestationSybilVerifyInput, storage: ConceptStorage) async throws -> AttestationSybilVerifyOutput {
        guard let cfg = try await storage.get(relation: "att_sybil", key: input.config) else { return .notFound(config: input.config) }
        let key = "\(input.config):\(input.candidate)"
        guard let credential = try await storage.get(relation: "att_sybil_credential", key: key) else { return .noAttestation(candidate: input.candidate) }
        let requiredSchema = cfg["requiredSchema"] as? String
        let credentialSchema = credential["schema"] as? String ?? ""
        if let rs = requiredSchema, credentialSchema != rs { return .schemaMismatch(candidate: input.candidate, expected: rs, actual: credentialSchema) }
        let requiredAttester = cfg["requiredAttester"] as? String
        let credentialAttester = credential["attester"] as? String ?? ""
        if let ra = requiredAttester, credentialAttester != ra { return .attesterMismatch(candidate: input.candidate, expected: ra, actual: credentialAttester) }
        if let expiresStr = credential["expiresAt"] as? String, let expires = ISO8601DateFormatter().date(from: expiresStr), Date() > expires {
            return .expired(candidate: input.candidate, expiresAt: expiresStr)
        }
        return .verified(candidate: input.candidate, attestationRef: (credential["attestationRef"] as? String) ?? "")
    }
}
