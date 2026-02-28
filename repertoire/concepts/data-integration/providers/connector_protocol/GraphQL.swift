// GraphQL.swift — connector_protocol provider
// GraphQL connector with variable binding, relay cursor pagination, query batching, and schema introspection

import Foundation

public let graphqlProviderId = "graphql"
public let graphqlPluginType = "connector_protocol"

public struct GqlConnectorConfig: Codable {
    public var baseUrl: String?
    public var connectionString: String?
    public var auth: [String: String]?
    public var headers: [String: String]?
    public var options: [String: String]?
}

public struct GqlQuerySpec: Codable {
    public var path: String?
    public var query: String?
    public var params: [String: String]?
    public var cursor: String?
    public var limit: Int?
}

public struct GqlWriteResult: Codable {
    public var created: Int
    public var updated: Int
    public var skipped: Int
    public var errors: Int
}

public struct GqlTestResult: Codable {
    public var connected: Bool
    public var message: String
    public var latencyMs: Int?
}

public struct GqlStreamDef: Codable {
    public var name: String
    public var schema: [String: String]
    public var supportedSyncModes: [String]
}

public struct GqlDiscoveryResult: Codable {
    public var streams: [GqlStreamDef]
}

public enum GraphQLConnectorError: Error, LocalizedError {
    case requestFailed(String)
    case graphqlErrors([String])
    case parseError(String)

    public var errorDescription: String? {
        switch self {
        case .requestFailed(let msg): return "Request failed: \(msg)"
        case .graphqlErrors(let errs): return "GraphQL errors: \(errs.joined(separator: "; "))"
        case .parseError(let msg): return "Parse error: \(msg)"
        }
    }
}

private struct GraphQLRequest: Codable {
    let query: String
    let variables: [String: String]?
}

public final class GraphqlConnectorProvider {
    private let session: URLSession

    public init() {
        self.session = URLSession(configuration: .default)
    }

    private func buildHeaders(config: GqlConnectorConfig) -> [String: String] {
        var headers = ["Content-Type": "application/json"]
        if let cfgH = config.headers { headers.merge(cfgH) { _, new in new } }
        if let auth = config.auth {
            switch auth["style"] {
            case "bearer":
                if let token = auth["token"] { headers["Authorization"] = "Bearer \(token)" }
            case "api_key":
                let h = auth["apiKeyHeader"] ?? "X-API-Key"
                headers[h] = auth["apiKey"] ?? ""
            default: break
            }
        }
        return headers
    }

    private func executeGraphQL(
        endpoint: String,
        query: String,
        variables: [String: Any],
        headers: [String: String]
    ) async throws -> (data: [String: Any]?, errors: [[String: Any]]?) {
        guard let url = URL(string: endpoint) else {
            throw GraphQLConnectorError.requestFailed("Invalid endpoint URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

        let body: [String: Any] = ["query": query, "variables": variables]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let httpResp = response as? HTTPURLResponse, httpResp.statusCode >= 200, httpResp.statusCode < 300 else {
            throw GraphQLConnectorError.requestFailed("HTTP error")
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw GraphQLConnectorError.parseError("Response is not JSON object")
        }
        return (json["data"] as? [String: Any], json["errors"] as? [[String: Any]])
    }

    private func extractConnection(from data: [String: Any]) -> (records: [[String: Any]], hasNext: Bool, endCursor: String?)? {
        for (_, value) in data {
            guard let connObj = value as? [String: Any] else { continue }
            if let edges = connObj["edges"] as? [[String: Any]] {
                let nodes = edges.compactMap { $0["node"] as? [String: Any] }
                let pageInfo = connObj["pageInfo"] as? [String: Any]
                let hasNext = (pageInfo?["hasNextPage"] as? Bool) ?? false
                let endCursor = pageInfo?["endCursor"] as? String
                return (nodes, hasNext, endCursor)
            }
            if let nodes = connObj["nodes"] as? [[String: Any]] {
                let pageInfo = connObj["pageInfo"] as? [String: Any]
                let hasNext = (pageInfo?["hasNextPage"] as? Bool) ?? false
                let endCursor = pageInfo?["endCursor"] as? String
                return (nodes, hasNext, endCursor)
            }
        }
        return nil
    }

    public func read(query: GqlQuerySpec, config: GqlConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let endpoint = config.baseUrl ?? ""
        let gqlQuery = query.query ?? ""
        let headers = buildHeaders(config: config)
        let pageSize = query.limit ?? 50

        return AsyncStream { continuation in
            Task {
                var cursor = query.cursor
                var hasMore = true

                while hasMore {
                    var variables: [String: Any] = ["first": pageSize]
                    if let params = query.params {
                        for (k, v) in params { variables[k] = v }
                    }
                    if let c = cursor { variables["after"] = c }

                    do {
                        let (data, errors) = try await self.executeGraphQL(
                            endpoint: endpoint, query: gqlQuery, variables: variables, headers: headers
                        )
                        if let errs = errors, !errs.isEmpty {
                            continuation.finish()
                            return
                        }
                        guard let resultData = data else {
                            hasMore = false
                            continue
                        }
                        if let conn = self.extractConnection(from: resultData) {
                            for record in conn.records { continuation.yield(record) }
                            hasMore = conn.hasNext
                            cursor = conn.endCursor
                        } else {
                            for (_, value) in resultData {
                                if let arr = value as? [[String: Any]] {
                                    for item in arr { continuation.yield(item) }
                                }
                            }
                            hasMore = false
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

    public func write(records: [[String: Any]], config: GqlConnectorConfig) async throws -> GqlWriteResult {
        let endpoint = config.baseUrl ?? ""
        let mutation = config.options?["mutation"] ?? ""
        let headers = buildHeaders(config: config)
        var result = GqlWriteResult(created: 0, updated: 0, skipped: 0, errors: 0)

        for record in records {
            do {
                let (_, errors) = try await executeGraphQL(
                    endpoint: endpoint, query: mutation, variables: ["input": record], headers: headers
                )
                if let errs = errors, !errs.isEmpty { result.errors += 1 }
                else { result.created += 1 }
            } catch {
                result.errors += 1
            }
        }
        return result
    }

    public func test(config: GqlConnectorConfig) async throws -> GqlTestResult {
        let endpoint = config.baseUrl ?? ""
        let headers = buildHeaders(config: config)
        let start = Date()
        do {
            let (data, errors) = try await executeGraphQL(
                endpoint: endpoint, query: "{ __typename }", variables: [:], headers: headers
            )
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            let hasErr = (errors?.isEmpty == false)
            return GqlTestResult(
                connected: !hasErr && data != nil,
                message: hasErr ? "GraphQL errors returned" : "Connected successfully",
                latencyMs: ms
            )
        } catch {
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return GqlTestResult(connected: false, message: error.localizedDescription, latencyMs: ms)
        }
    }

    public func discover(config: GqlConnectorConfig) async throws -> GqlDiscoveryResult {
        let endpoint = config.baseUrl ?? ""
        let headers = buildHeaders(config: config)
        let introspection = """
        query IntrospectionQuery {
          __schema {
            types { name kind fields { name type { name kind } } }
          }
        }
        """
        do {
            let (data, _) = try await executeGraphQL(
                endpoint: endpoint, query: introspection, variables: [:], headers: headers
            )
            guard let schema = data?["__schema"] as? [String: Any],
                  let types = schema["types"] as? [[String: Any]] else {
                return GqlDiscoveryResult(streams: [])
            }
            let streams = types
                .filter { ($0["kind"] as? String) == "OBJECT" && !((($0["name"] as? String) ?? "").hasPrefix("__")) }
                .map { t -> GqlStreamDef in
                    let name = (t["name"] as? String) ?? ""
                    var schemaDict = [String: String]()
                    if let fields = t["fields"] as? [[String: Any]] {
                        for field in fields {
                            let fname = (field["name"] as? String) ?? ""
                            let ftype = ((field["type"] as? [String: Any])?["name"] as? String) ?? "Any"
                            schemaDict[fname] = ftype
                        }
                    }
                    return GqlStreamDef(name: name, schema: schemaDict, supportedSyncModes: ["full_refresh"])
                }
            return GqlDiscoveryResult(streams: streams)
        } catch {
            return GqlDiscoveryResult(streams: [])
        }
    }
}
