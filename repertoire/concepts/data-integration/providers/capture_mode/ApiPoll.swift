// Data Integration Kit - API Poll Capture Provider
// Periodic API query with delta detection via hash, cursor, or timestamp strategies

import Foundation

public enum DeltaStrategy: String {
    case hash
    case cursor
    case timestamp
}

public final class ApiPollCaptureProvider {

    private struct PollConfig {
        var endpoint: String
        var method: String
        var headers: [String: String]
        var body: String?
        var deltaStrategy: DeltaStrategy
        var timestampField: String
        var cursorField: String
        var itemsPath: String?
        var pollIntervalMs: Int
    }

    private struct PollState {
        var lastHash: String?
        var lastTimestamp: String?
        var lastCursor: String?
        var lastPollAt: String?
    }

    private var stateStore: [String: PollState] = [:]

    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        let pollConfig = parsePollConfig(input: input, config: config)
        guard !pollConfig.endpoint.isEmpty else {
            throw CaptureError.parseError("api_poll capture requires an endpoint URL")
        }

        let stateKey = computeHash(pollConfig.endpoint + pollConfig.method)
        let previousState = stateStore[stateKey] ?? PollState()

        var requestUrl = pollConfig.endpoint
        if pollConfig.deltaStrategy == .cursor, let cursor = previousState.lastCursor {
            let separator = requestUrl.contains("?") ? "&" : "?"
            requestUrl += "\(separator)cursor=\(cursor.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? cursor)"
        }
        if pollConfig.deltaStrategy == .timestamp, let ts = previousState.lastTimestamp {
            let separator = requestUrl.contains("?") ? "&" : "?"
            requestUrl += "\(separator)since=\(ts.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ts)"
        }

        guard let url = URL(string: requestUrl) else {
            throw CaptureError.parseError("Invalid endpoint URL: \(requestUrl)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = pollConfig.method
        for (key, value) in pollConfig.headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        if let body = pollConfig.body, pollConfig.method != "GET" {
            request.httpBody = body.data(using: .utf8)
        }

        let (data, _) = try await URLSession.shared.data(for: request)
        let responseBody = String(data: data, encoding: .utf8) ?? ""
        let now = ISO8601DateFormatter().string(from: Date())

        let parsedData = try? JSONSerialization.jsonObject(with: data)

        var changed = false
        var capturedItems: [Any] = []
        var newState = PollState(lastPollAt: now)

        switch pollConfig.deltaStrategy {
        case .hash:
            let newHash = computeHash(responseBody)
            changed = previousState.lastHash.map { $0 != newHash } ?? true
            newState.lastHash = newHash
            if changed, let parsed = parsedData { capturedItems = [parsed] }

        case .timestamp:
            let result = detectChangesTimestamp(
                data: parsedData, itemsPath: pollConfig.itemsPath,
                timestampField: pollConfig.timestampField,
                lastTimestamp: previousState.lastTimestamp
            )
            changed = result.changed
            capturedItems = result.newItems
            newState.lastTimestamp = result.latestTimestamp ?? previousState.lastTimestamp

        case .cursor:
            let result = detectChangesCursor(
                data: parsedData, cursorField: pollConfig.cursorField,
                itemsPath: pollConfig.itemsPath
            )
            changed = !result.items.isEmpty
            capturedItems = result.items
            newState.lastCursor = result.nextCursor
        }

        stateStore[stateKey] = newState

        let content: String
        if changed, let jsonData = try? JSONSerialization.data(withJSONObject: capturedItems, options: .prettyPrinted) {
            content = String(data: jsonData, encoding: .utf8) ?? "(serialization error)"
        } else if changed {
            content = "\(capturedItems)"
        } else {
            content = "(no changes detected)"
        }

        let hostname = URL(string: pollConfig.endpoint)?.host ?? pollConfig.endpoint

        return CaptureItem(
            content: content,
            sourceMetadata: SourceMetadata(
                title: "API Poll: \(hostname)",
                url: pollConfig.endpoint,
                capturedAt: now,
                contentType: "application/json",
                author: nil,
                tags: [
                    "api-poll",
                    pollConfig.deltaStrategy.rawValue,
                    changed ? "changed" : "unchanged",
                    "items:\(capturedItems.count)"
                ],
                source: "api_poll"
            ),
            rawData: (config.options?["includeState"] as? Bool == true)
                ? ["stateKey": stateKey] as [String: Any]
                : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let url = input.url else { return false }
        return url.hasPrefix("http://") || url.hasPrefix("https://")
    }

    // MARK: - DJB2 Hash for Delta Comparison

    private func computeHash(_ data: String) -> String {
        var hash: UInt32 = 5381
        for byte in data.utf8 {
            hash = hash &<< 5 &+ hash &+ UInt32(byte)
        }
        return String(hash, radix: 16)
    }

    // MARK: - Poll Configuration Parsing

    private func parsePollConfig(input: CaptureInput, config: CaptureConfig) -> PollConfig {
        let opts = config.options
        let endpoint = input.url ?? (opts?["endpoint"] as? String) ?? ""
        let method = ((opts?["method"] as? String) ?? "GET").uppercased()

        var headers = ["Accept": "application/json"]
        if let h = opts?["headers"] as? [String: String] {
            for (k, v) in h { headers[k] = v }
        }

        let strategyStr = (opts?["deltaStrategy"] as? String) ?? "hash"
        let strategy = DeltaStrategy(rawValue: strategyStr) ?? .hash

        return PollConfig(
            endpoint: endpoint,
            method: method,
            headers: headers,
            body: opts?["body"] as? String,
            deltaStrategy: strategy,
            timestampField: (opts?["timestampField"] as? String) ?? "updated_at",
            cursorField: (opts?["cursorField"] as? String) ?? "next_cursor",
            itemsPath: opts?["itemsPath"] as? String,
            pollIntervalMs: (opts?["pollIntervalMs"] as? Int) ?? 60000
        )
    }

    // MARK: - JSON Path Extraction

    private func extractJsonPath(_ obj: Any?, path: String) -> Any? {
        let parts = path.components(separatedBy: ".")
        var current = obj
        for part in parts {
            guard let dict = current as? [String: Any] else { return nil }
            current = dict[part]
        }
        return current
    }

    // MARK: - Delta Detection Strategies

    private func detectChangesTimestamp(
        data: Any?, itemsPath: String?, timestampField: String, lastTimestamp: String?
    ) -> (changed: Bool, newItems: [Any], latestTimestamp: String?) {
        let items: [Any]
        if let path = itemsPath, let arr = extractJsonPath(data, path: path) as? [Any] {
            items = arr
        } else if let arr = data as? [Any] {
            items = arr
        } else if let d = data {
            items = [d]
        } else {
            return (false, [], nil)
        }

        var newItems: [Any] = []
        var latestTimestamp: String?

        for item in items {
            guard let ts = extractJsonPath(item, path: timestampField) as? String else { continue }
            if lastTimestamp == nil || ts > lastTimestamp! {
                newItems.append(item)
            }
            if latestTimestamp == nil || ts > latestTimestamp! {
                latestTimestamp = ts
            }
        }

        return (changed: !newItems.isEmpty, newItems: newItems, latestTimestamp: latestTimestamp)
    }

    private func detectChangesCursor(
        data: Any?, cursorField: String, itemsPath: String?
    ) -> (items: [Any], nextCursor: String?) {
        let items: [Any]
        if let path = itemsPath, let arr = extractJsonPath(data, path: path) as? [Any] {
            items = arr
        } else if let arr = data as? [Any] {
            items = arr
        } else if let d = data {
            items = [d]
        } else {
            items = []
        }

        let nextCursor = extractJsonPath(data, path: cursorField) as? String
        return (items: items, nextCursor: nextCursor)
    }
}
