// JWTImpl.swift — JWT concept implementation

import Foundation
import Crypto

// MARK: - Types (matching generated JWT/Types.swift)

public struct JWTGenerateInput: Codable {
    public let user: String

    public init(user: String) {
        self.user = user
    }
}

public enum JWTGenerateOutput: Codable {
    case ok(token: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case token
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                token: try container.decode(String.self, forKey: .token)
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
        case .ok(let token):
            try container.encode("ok", forKey: .variant)
            try container.encode(token, forKey: .token)
        }
    }
}

public struct JWTVerifyInput: Codable {
    public let token: String

    public init(token: String) {
        self.token = token
    }
}

public enum JWTVerifyOutput: Codable {
    case ok(user: String)
    case error(message: String)

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
        case "error":
            self = .error(
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
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol (matching generated JWT/Handler.swift)

public protocol JWTHandler {
    func generate(
        input: JWTGenerateInput,
        storage: ConceptStorage
    ) async throws -> JWTGenerateOutput

    func verify(
        input: JWTVerifyInput,
        storage: ConceptStorage
    ) async throws -> JWTVerifyOutput
}

// MARK: - Implementation

public struct JWTHandlerImpl: JWTHandler {
    /// The secret key used for HMAC-SHA256 signing
    private let secret: String

    public init(secret: String = "copf-default-secret-key-change-in-production") {
        self.secret = secret
    }

    /// Base64url encode data (no padding)
    private func base64urlEncode(_ data: Data) -> String {
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Base64url decode a string
    private func base64urlDecode(_ string: String) -> Data? {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        // Add padding if needed
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }
        return Data(base64Encoded: base64)
    }

    /// Compute HMAC-SHA256 signature
    private func sign(_ message: String) -> String {
        let key = SymmetricKey(data: Data(secret.utf8))
        let signature = HMAC<SHA256>.authenticationCode(
            for: Data(message.utf8),
            using: key
        )
        return base64urlEncode(Data(signature))
    }

    public func generate(
        input: JWTGenerateInput,
        storage: ConceptStorage
    ) async throws -> JWTGenerateOutput {
        // Header: {"alg":"HS256","typ":"JWT"}
        let headerJSON = #"{"alg":"HS256","typ":"JWT"}"#
        let headerEncoded = base64urlEncode(Data(headerJSON.utf8))

        // Payload: {"sub":"<user>","iat":<timestamp>}
        let now = Int(Date().timeIntervalSince1970)
        let payloadJSON = #"{"sub":"\#(input.user)","iat":\#(now)}"#
        let payloadEncoded = base64urlEncode(Data(payloadJSON.utf8))

        // Signature
        let signingInput = "\(headerEncoded).\(payloadEncoded)"
        let signature = sign(signingInput)

        let token = "\(signingInput).\(signature)"
        return .ok(token: token)
    }

    public func verify(
        input: JWTVerifyInput,
        storage: ConceptStorage
    ) async throws -> JWTVerifyOutput {
        let parts = input.token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3 else {
            return .error(message: "Invalid token format: expected 3 parts separated by dots")
        }

        let headerEncoded = String(parts[0])
        let payloadEncoded = String(parts[1])
        let signatureProvided = String(parts[2])

        // Verify signature
        let signingInput = "\(headerEncoded).\(payloadEncoded)"
        let expectedSignature = sign(signingInput)
        guard signatureProvided == expectedSignature else {
            return .error(message: "Invalid token signature")
        }

        // Decode payload
        guard let payloadData = base64urlDecode(payloadEncoded) else {
            return .error(message: "Failed to decode token payload")
        }

        guard let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any],
              let sub = payload["sub"] as? String else {
            return .error(message: "Invalid token payload: missing 'sub' claim")
        }

        return .ok(user: sub)
    }
}
