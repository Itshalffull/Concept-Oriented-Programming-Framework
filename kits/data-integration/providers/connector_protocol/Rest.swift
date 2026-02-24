// Rest.swift — connector_protocol provider
// Generic REST API connector with pagination, auth, rate limiting, and retry logic

import Foundation

public let restProviderId = "rest"
public let restPluginType = "connector_protocol"

public struct ConnectorConfig: Codable {
    public var baseUrl: String?
    public var connectionString: String?
    public var auth: [String: String]?
    public var headers: [String: String]?
    public var options: [String: String]?
}

public struct QuerySpec: Codable {
    public var path: String?
    public var query: String?
    public var params: [String: String]?
    public var cursor: String?
    public var limit: Int?
}

public struct WriteResult: Codable {
    public var created: Int
    public var updated: Int
    public var skipped: Int
    public var errors: Int
}

public struct TestResult: Codable {
    public var connected: Bool
    public var message: String
    public var latencyMs: Int?
}

public struct StreamDef: Codable {
    public var name: String
    public var schema: [String: String]
    public var supportedSyncModes: [String]
}

public struct DiscoveryResult: Codable {
    public var streams: [StreamDef]
}

public enum ConnectorError: Error, LocalizedError {
    case connectionFailed(String)
    case requestFailed(Int, String)
    case parseError(String)

    public var errorDescription: String? {
        switch self {
        case .connectionFailed(let msg): return "Connection failed: \(msg)"
        case .requestFailed(let code, let msg): return "Request failed (\(code)): \(msg)"
        case .parseError(let msg): return "Parse error: \(msg)"
        }
    }
}

public final class RestConnectorProvider {
    private let session: URLSession
    private var cachedToken: String?

    public init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: cfg)
    }

    private func buildHeaders(config: ConnectorConfig) -> [String: String] {
        var headers = ["Content-Type": "application/json"]
        if let cfgHeaders = config.headers {
            headers.merge(cfgHeaders) { _, new in new }
        }
        if let auth = config.auth {
            switch auth["style"] {
            case "bearer":
                if let token = auth["token"] {
                    headers["Authorization"] = "Bearer \(token)"
                }
            case "api_key":
                let headerName = auth["apiKeyHeader"] ?? "X-API-Key"
                headers[headerName] = auth["apiKey"] ?? ""
            case "basic":
                let creds = "\(auth["username"] ?? ""):\(auth["password"] ?? "")"
                if let data = creds.data(using: .utf8) {
                    headers["Authorization"] = "Basic \(data.base64EncodedString())"
                }
            default:
                break
            }
        }
        return headers
    }

    private func fetchWithRetry(url: URL, headers: [String: String], maxRetries: Int = 3) async throws -> (Data, HTTPURLResponse) {
        var lastError: Error = ConnectorError.connectionFailed("Unknown error")
        for attempt in 0...maxRetries {
            var request = URLRequest(url: url)
            for (key, value) in headers {
                request.setValue(value, forHTTPHeaderField: key)
            }
            do {
                let (data, response) = try await session.data(for: request)
                guard let httpResp = response as? HTTPURLResponse else {
                    throw ConnectorError.connectionFailed("Invalid response type")
                }
                if httpResp.statusCode == 429 || httpResp.statusCode >= 500 {
                    let retryAfter = httpResp.value(forHTTPHeaderField: "Retry-After")
                        .flatMap { Int($0) } ?? Int(pow(2.0, Double(attempt)))
                    try await Task.sleep(nanoseconds: UInt64(retryAfter) * 1_000_000_000)
                    continue
                }
                return (data, httpResp)
            } catch {
                lastError = error
                if attempt < maxRetries {
                    try await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
                }
            }
        }
        throw lastError
    }

    public func read(query: QuerySpec, config: ConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let baseUrl = (config.baseUrl ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let path = query.path ?? "/"
        let pageSize = query.limit ?? 100
        let headers = buildHeaders(config: config)
        let pagination = config.options?["pagination"] ?? "offset"
        let dataKey = config.options?["dataKey"] ?? "data"

        return AsyncStream { continuation in
            Task {
                var offset = 0
                var cursor = query.cursor
                var hasMore = true

                while hasMore {
                    var urlString = "\(baseUrl)\(path)?limit=\(pageSize)"
                    if let params = query.params {
                        for (k, v) in params { urlString += "&\(k)=\(v)" }
                    }
                    switch pagination {
                    case "cursor":
                        if let c = cursor { urlString += "&cursor=\(c)" }
                    case "offset":
                        urlString += "&offset=\(offset)"
                    default: break
                    }

                    guard let url = URL(string: urlString) else {
                        continuation.finish()
                        return
                    }

                    do {
                        let (data, resp) = try await self.fetchWithRetry(url: url, headers: headers)
                        guard resp.statusCode >= 200 && resp.statusCode < 300 else {
                            continuation.finish()
                            return
                        }
                        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            if let arr = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                                for record in arr { continuation.yield(record) }
                                hasMore = arr.count >= pageSize
                                offset += arr.count
                                continue
                            }
                            continuation.finish()
                            return
                        }

                        let records = (json[dataKey] as? [[String: Any]]) ?? []
                        for record in records { continuation.yield(record) }

                        if records.count < pageSize {
                            hasMore = false
                        } else if pagination == "cursor" {
                            cursor = (json["next_cursor"] as? String) ?? (json["cursor"] as? String)
                            hasMore = cursor != nil
                        } else {
                            offset += records.count
                        }
                    } catch {
                        continuation.finish()
                        return
                    }
                }
                continuation.finish()
            }
        }
    }

    public func write(records: [[String: Any]], config: ConnectorConfig) async throws -> WriteResult {
        let baseUrl = (config.baseUrl ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let writePath = config.options?["writePath"] ?? "/"
        let batchSize = Int(config.options?["batchSize"] ?? "50") ?? 50
        let headers = buildHeaders(config: config)
        var result = WriteResult(created: 0, updated: 0, skipped: 0, errors: 0)

        for i in stride(from: 0, to: records.count, by: batchSize) {
            let end = min(i + batchSize, records.count)
            let batch = Array(records[i..<end])
            guard let url = URL(string: "\(baseUrl)\(writePath)") else { continue }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
            request.httpBody = try JSONSerialization.data(withJSONObject: batch)

            do {
                let (_, resp) = try await session.data(for: request)
                if let httpResp = resp as? HTTPURLResponse, httpResp.statusCode >= 200, httpResp.statusCode < 300 {
                    result.created += batch.count
                } else {
                    result.errors += batch.count
                }
            } catch {
                result.errors += batch.count
            }
        }
        return result
    }

    public func test(config: ConnectorConfig) async throws -> TestResult {
        let baseUrl = (config.baseUrl ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let healthPath = config.options?["healthPath"] ?? "/"
        let headers = buildHeaders(config: config)
        let start = Date()

        guard let url = URL(string: "\(baseUrl)\(healthPath)") else {
            return TestResult(connected: false, message: "Invalid URL", latencyMs: 0)
        }
        do {
            let (_, resp) = try await fetchWithRetry(url: url, headers: headers, maxRetries: 1)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            let ok = resp.statusCode >= 200 && resp.statusCode < 300
            return TestResult(connected: ok, message: ok ? "Connected successfully" : "HTTP \(resp.statusCode)", latencyMs: ms)
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return TestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: ConnectorConfig) async throws -> DiscoveryResult {
        let baseUrl = (config.baseUrl ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let discPath = config.options?["discoveryPath"] ?? "/"
        let headers = buildHeaders(config: config)
        guard let url = URL(string: "\(baseUrl)\(discPath)") else {
            return DiscoveryResult(streams: [])
        }
        do {
            let (data, resp) = try await fetchWithRetry(url: url, headers: headers, maxRetries: 1)
            guard resp.statusCode >= 200, resp.statusCode < 300 else { return DiscoveryResult(streams: []) }
            let json = try JSONSerialization.jsonObject(with: data)
            var names: [String] = []
            if let arr = json as? [String] {
                names = arr
            } else if let dict = json as? [String: Any] {
                names = Array(dict.keys)
            }
            return DiscoveryResult(streams: names.map { StreamDef(name: $0, schema: [:], supportedSyncModes: ["full_refresh", "incremental"]) })
        } catch {
            return DiscoveryResult(streams: [])
        }
    }
}
