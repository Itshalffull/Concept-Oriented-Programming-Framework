// WebSocket.swift — connector_protocol provider
// WebSocket streaming with persistent connections, JSON/binary framing, auto-reconnect with backoff, and message buffering

import Foundation

public let websocketProviderId = "websocket"
public let websocketPluginType = "connector_protocol"

public struct WsConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct WsQuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct WsWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct WsTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct WsStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct WsDiscoveryResult: Codable { public var streams: [WsStreamDef] }
public enum WsConnectorError: Error { case connectionFailed(String); case sendFailed(String) }

private struct WsCfg {
    var url: String; var protocols: [String]
    var maxReconnectAttempts: Int; var reconnectBaseDelay: TimeInterval; var maxReconnectDelay: TimeInterval
    var heartbeatInterval: TimeInterval; var heartbeatMessage: String
    var bufferSize: Int; var messageFormat: String
    var subscribeMessage: String?
}

private struct BufferedMessage {
    var id: String; var timestamp: String; var data: [String: Any]
}

private func parseWsConfig(_ config: WsConnectorConfig) -> WsCfg {
    var url = config.baseUrl ?? ""
    if url.hasPrefix("http://") { url = url.replacingOccurrences(of: "http://", with: "ws://") }
    if url.hasPrefix("https://") { url = url.replacingOccurrences(of: "https://", with: "wss://") }
    if !url.hasPrefix("ws://") && !url.hasPrefix("wss://") { url = "wss://\(url)" }

    return WsCfg(
        url: url,
        protocols: (config.options?["protocols"] ?? "").split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
        maxReconnectAttempts: Int(config.options?["maxReconnectAttempts"] ?? "10") ?? 10,
        reconnectBaseDelay: Double(config.options?["reconnectBaseDelay"] ?? "1.0") ?? 1.0,
        maxReconnectDelay: Double(config.options?["maxReconnectDelay"] ?? "30.0") ?? 30.0,
        heartbeatInterval: Double(config.options?["heartbeatInterval"] ?? "30.0") ?? 30.0,
        heartbeatMessage: config.options?["heartbeatMessage"] ?? "{\"type\":\"ping\"}",
        bufferSize: Int(config.options?["bufferSize"] ?? "10000") ?? 10000,
        messageFormat: config.options?["messageFormat"] ?? "json",
        subscribeMessage: config.options?["subscribeMessage"]
    )
}

public final class WebsocketConnectorProvider {
    private var wsTask: URLSessionWebSocketTask?
    private var buffer = [BufferedMessage]()
    private var wsCfg: WsCfg?
    private var isConnected = false
    private var reconnectAttempts = 0
    private let session = URLSession(configuration: .default)

    public init() {}

    private func generateId() -> String {
        "msg_\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(6).lowercased())"
    }

    private func bufferMessage(_ data: [String: Any]) {
        let maxSize = wsCfg?.bufferSize ?? 10000
        if buffer.count >= maxSize { buffer.removeFirst() }
        buffer.append(BufferedMessage(
            id: generateId(),
            timestamp: ISO8601DateFormatter().string(from: Date()),
            data: data
        ))
    }

    private func connect(config: WsCfg) async throws {
        guard let url = URL(string: config.url) else {
            throw WsConnectorError.connectionFailed("Invalid URL: \(config.url)")
        }
        wsTask = session.webSocketTask(with: url)
        wsTask?.resume()
        isConnected = true
        reconnectAttempts = 0

        if let sub = config.subscribeMessage {
            try? await wsTask?.send(.string(sub))
        }

        // Start listening for messages in background
        Task { await receiveMessages() }

        // Start heartbeat
        if config.heartbeatInterval > 0 {
            Task {
                while isConnected {
                    try? await Task.sleep(nanoseconds: UInt64(config.heartbeatInterval * 1_000_000_000))
                    if isConnected {
                        try? await wsTask?.send(.string(config.heartbeatMessage))
                    }
                }
            }
        }
    }

    private func receiveMessages() async {
        while isConnected {
            guard let task = wsTask else { return }
            do {
                let message = try await task.receive()
                switch message {
                case .string(let text):
                    if let data = text.data(using: .utf8),
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        bufferMessage(json)
                    } else {
                        bufferMessage(["raw": text])
                    }
                case .data(let data):
                    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        bufferMessage(json)
                    } else {
                        bufferMessage(["binary": true, "size": data.count])
                    }
                @unknown default:
                    break
                }
            } catch {
                isConnected = false
                scheduleReconnect()
                return
            }
        }
    }

    private func scheduleReconnect() {
        guard let cfg = wsCfg, reconnectAttempts < cfg.maxReconnectAttempts else { return }
        reconnectAttempts += 1
        let delay = min(cfg.reconnectBaseDelay * pow(2.0, Double(reconnectAttempts - 1)), cfg.maxReconnectDelay)
        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            try? await connect(config: cfg)
        }
    }

    public func read(query: WsQuerySpec, config: WsConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        wsCfg = parseWsConfig(config)
        if !isConnected, let cfg = wsCfg { try await connect(config: cfg) }
        let limit = query.limit ?? Int.max
        let cursor = query.cursor

        return AsyncStream { continuation in
            var startIdx = 0
            if let sinceId = cursor, let idx = self.buffer.firstIndex(where: { $0.id == sinceId }) {
                startIdx = idx + 1
            }
            var yielded = 0
            for i in startIdx..<self.buffer.count {
                if yielded >= limit { break }
                let msg = self.buffer[i]
                var record = msg.data
                record["id"] = msg.id
                record["timestamp"] = msg.timestamp
                continuation.yield(record)
                yielded += 1
            }
            continuation.finish()
        }
    }

    public func write(records: [[String: Any]], config: WsConnectorConfig) async throws -> WsWriteResult {
        if !isConnected, let cfg = parseWsConfig(config) as WsCfg? {
            wsCfg = cfg
            try await connect(config: cfg)
        }
        var result = WsWriteResult(created: 0, updated: 0, skipped: 0, errors: 0)
        for record in records {
            do {
                let data = try JSONSerialization.data(withJSONObject: record)
                let str = String(data: data, encoding: .utf8) ?? "{}"
                try await wsTask?.send(.string(str))
                result.created += 1
            } catch {
                result.errors += 1
            }
        }
        return result
    }

    public func test(config: WsConnectorConfig) async throws -> WsTestResult {
        let cfg = parseWsConfig(config)
        let start = Date()
        do {
            try await connect(config: cfg)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return WsTestResult(connected: true, message: "Connected to \(cfg.url)", latencyMs: ms)
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return WsTestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: WsConnectorConfig) async throws -> WsDiscoveryResult {
        let cfg = parseWsConfig(config)
        return WsDiscoveryResult(streams: [
            WsStreamDef(name: cfg.url, schema: [
                "id": "string", "timestamp": "string", "data": "object"
            ], supportedSyncModes: ["incremental"])
        ])
    }

    public func disconnect() {
        isConnected = false
        reconnectAttempts = wsCfg?.maxReconnectAttempts ?? 999
        wsTask?.cancel(with: .normalClosure, reason: nil)
        wsTask = nil
    }
}
