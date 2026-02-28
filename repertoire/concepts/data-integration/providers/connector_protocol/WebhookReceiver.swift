// WebhookReceiver.swift — connector_protocol provider
// Inbound webhook endpoint with HMAC-SHA256 signature validation, payload queuing, and retry acknowledgment

import Foundation
#if canImport(CommonCrypto)
import CommonCrypto
#endif

public let webhookReceiverProviderId = "webhook_receiver"
public let webhookReceiverPluginType = "connector_protocol"

public struct WhConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct WhQuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct WhWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct WhTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct WhStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct WhDiscoveryResult: Codable { public var streams: [WhStreamDef] }

private struct QueuedPayload {
    var id: String; var receivedAt: String; var headers: [String: String]
    var body: [String: Any]; var verified: Bool; var acknowledged: Bool; var retryCount: Int
}

private func generateId() -> String {
    "wh_\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(8).lowercased())"
}

private func computeHmacSha256(secret: String, payload: String) -> String {
    #if canImport(CommonCrypto)
    guard let keyData = secret.data(using: .utf8), let payloadData = payload.data(using: .utf8) else { return "" }
    var hmac = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
    keyData.withUnsafeBytes { keyBytes in
        payloadData.withUnsafeBytes { payloadBytes in
            CCHmac(CCHmacAlgorithm(kCCHmacAlgSHA256), keyBytes.baseAddress, keyData.count, payloadBytes.baseAddress, payloadData.count, &hmac)
        }
    }
    return hmac.map { String(format: "%02x", $0) }.joined()
    #else
    return ""
    #endif
}

private func verifySignature(payload: String, signature: String?, secret: String, prefix: String) -> Bool {
    if secret.isEmpty { return true }
    guard let sig = signature else { return false }
    let computed = computeHmacSha256(secret: secret, payload: payload)
    let expected = sig.hasPrefix(prefix) ? String(sig.dropFirst(prefix.count)) : sig
    guard computed.count == expected.count else { return false }
    var result: UInt8 = 0
    for (a, b) in zip(computed.utf8, expected.utf8) { result |= a ^ b }
    return result == 0
}

public final class WebhookReceiverConnectorProvider {
    private var queue = [QueuedPayload]()
    private var maxQueueSize = 10000
    private var secret = ""
    private var signatureHeader = "x-hub-signature-256"
    private var signaturePrefix = "sha256="

    public init() {}

    private func configure(config: WhConnectorConfig) {
        secret = config.auth?["secret"] ?? ""
        signatureHeader = config.options?["signatureHeader"] ?? "x-hub-signature-256"
        signaturePrefix = config.options?["signaturePrefix"] ?? "sha256="
        maxQueueSize = Int(config.options?["maxQueueSize"] ?? "10000") ?? 10000
    }

    public func receiveWebhook(body: String, headers: [String: String]) -> (accepted: Bool, id: String?, message: String) {
        let signature = headers[signatureHeader] ?? headers[signatureHeader.lowercased()]
        let verified = verifySignature(payload: body, signature: signature, secret: secret, prefix: signaturePrefix)

        if !secret.isEmpty && !verified {
            return (false, nil, "Invalid signature")
        }

        if queue.count >= maxQueueSize {
            if let idx = queue.firstIndex(where: { $0.acknowledged }) {
                queue.removeSubrange(0...idx)
            } else {
                queue.removeFirst()
            }
        }

        let parsedBody: [String: Any]
        if let data = body.data(using: .utf8), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            parsedBody = json
        } else {
            parsedBody = ["raw": body]
        }

        let id = generateId()
        let now = ISO8601DateFormatter().string(from: Date())
        queue.append(QueuedPayload(id: id, receivedAt: now, headers: headers, body: parsedBody, verified: verified, acknowledged: false, retryCount: 0))
        return (true, id, "Payload queued")
    }

    public func acknowledge(id: String) -> Bool {
        if let idx = queue.firstIndex(where: { $0.id == id }) {
            queue[idx].acknowledged = true
            return true
        }
        return false
    }

    public func read(query: WhQuerySpec, config: WhConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        configure(config: config)
        let limit = query.limit ?? queue.count
        let onlyUnacked = (config.options?["onlyUnacknowledged"] ?? "true") == "true"
        let cursor = query.cursor

        var startIdx = 0
        if let sinceId = cursor, let idx = queue.firstIndex(where: { $0.id == sinceId }) {
            startIdx = idx + 1
        }

        return AsyncStream { continuation in
            var yielded = 0
            for i in startIdx..<self.queue.count {
                if yielded >= limit { break }
                let payload = self.queue[i]
                if onlyUnacked && payload.acknowledged { continue }
                continuation.yield([
                    "id": payload.id, "receivedAt": payload.receivedAt,
                    "body": payload.body, "verified": payload.verified,
                    "acknowledged": payload.acknowledged
                ])
                yielded += 1
            }
            continuation.finish()
        }
    }

    public func write(records: [[String: Any]], config: WhConnectorConfig) async throws -> WhWriteResult {
        var result = WhWriteResult(created: 0, updated: 0, skipped: 0, errors: 0)
        for record in records {
            if let id = record["id"] as? String, acknowledge(id: id) {
                result.updated += 1
            } else {
                result.skipped += 1
            }
        }
        return result
    }

    public func test(config: WhConnectorConfig) async throws -> WhTestResult {
        configure(config: config)
        return WhTestResult(
            connected: true,
            message: "Webhook receiver ready. Queue: \(queue.count)/\(maxQueueSize). Signature: \(secret.isEmpty ? "disabled" : "enabled")",
            latencyMs: 0
        )
    }

    public func discover(config: WhConnectorConfig) async throws -> WhDiscoveryResult {
        return WhDiscoveryResult(streams: [
            WhStreamDef(name: "webhooks", schema: [
                "id": "string", "receivedAt": "string", "body": "object",
                "verified": "boolean", "acknowledged": "boolean"
            ], supportedSyncModes: ["full_refresh", "incremental"])
        ])
    }
}
