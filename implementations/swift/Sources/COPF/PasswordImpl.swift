// PasswordImpl.swift — Password concept implementation

import Foundation
import Crypto

// MARK: - Types (matching generated Password/Types.swift)

public struct PasswordSetInput: Codable {
    public let user: String
    public let password: String

    public init(user: String, password: String) {
        self.user = user
        self.password = password
    }
}

public enum PasswordSetOutput: Codable {
    case ok(user: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user)
            )
        case "invalid":
            self = .invalid(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let user):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PasswordCheckInput: Codable {
    public let user: String
    public let password: String

    public init(user: String, password: String) {
        self.user = user
        self.password = password
    }
}

public enum PasswordCheckOutput: Codable {
    case ok(valid: Bool)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case valid
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                valid: try container.decode(Bool.self, forKey: .valid)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PasswordValidateInput: Codable {
    public let password: String

    public init(password: String) {
        self.password = password
    }
}

public enum PasswordValidateOutput: Codable {
    case ok(valid: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case valid
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                valid: try container.decode(Bool.self, forKey: .valid)
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
        case .ok(let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
        }
    }
}

// MARK: - Handler Protocol (matching generated Password/Handler.swift)

public protocol PasswordHandler {
    func set(
        input: PasswordSetInput,
        storage: ConceptStorage
    ) async throws -> PasswordSetOutput

    func check(
        input: PasswordCheckInput,
        storage: ConceptStorage
    ) async throws -> PasswordCheckOutput

    func validate(
        input: PasswordValidateInput,
        storage: ConceptStorage
    ) async throws -> PasswordValidateOutput
}

// MARK: - Implementation

public struct PasswordHandlerImpl: PasswordHandler {
    public init() {}

    /// Hash a password with the given salt using SHA256
    private func hashPassword(_ password: String, salt: Data) -> String {
        var data = salt
        data.append(contentsOf: password.utf8)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    public func set(
        input: PasswordSetInput,
        storage: ConceptStorage
    ) async throws -> PasswordSetOutput {
        // Validate password length
        guard input.password.count >= 8 else {
            return .invalid(message: "Password must be at least 8 characters long")
        }

        // Generate random 16-byte salt
        var saltBytes = [UInt8](repeating: 0, count: 16)
        for i in 0..<16 {
            saltBytes[i] = UInt8.random(in: 0...255)
        }
        let salt = Data(saltBytes)
        let saltHex = salt.map { String(format: "%02x", $0) }.joined()

        // Hash the password
        let hash = hashPassword(input.password, salt: salt)

        // Store hash and salt
        try await storage.put(
            relation: "password",
            key: input.user,
            value: [
                "user": input.user,
                "hash": hash,
                "salt": saltHex,
            ]
        )

        return .ok(user: input.user)
    }

    public func check(
        input: PasswordCheckInput,
        storage: ConceptStorage
    ) async throws -> PasswordCheckOutput {
        // Retrieve stored password record
        guard let record = try await storage.get(relation: "password", key: input.user) else {
            return .notfound(message: "No password set for user '\(input.user)'")
        }

        guard let storedHash = record["hash"] as? String,
              let saltHex = record["salt"] as? String else {
            return .notfound(message: "Corrupted password record for user '\(input.user)'")
        }

        // Convert salt hex back to Data
        let salt = Data(stride(from: 0, to: saltHex.count, by: 2).map { i in
            let start = saltHex.index(saltHex.startIndex, offsetBy: i)
            let end = saltHex.index(start, offsetBy: 2)
            return UInt8(saltHex[start..<end], radix: 16)!
        })

        // Recompute hash and compare
        let computedHash = hashPassword(input.password, salt: salt)
        return .ok(valid: computedHash == storedHash)
    }

    public func validate(
        input: PasswordValidateInput,
        storage: ConceptStorage
    ) async throws -> PasswordValidateOutput {
        return .ok(valid: input.password.count >= 8)
    }
}
