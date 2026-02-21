// Conduit Example App -- WatchKit API Client
// URLSession-based HTTP client optimized for watchOS with compact models.

import Foundation

// MARK: - Compact Models for Watch

struct WatchArticle: Codable, Identifiable {
    var id: String { slug }
    let slug: String
    let title: String
    let description: String
    let body: String
    let createdAt: String
    let favoritesCount: Int
    let author: WatchProfile
}

struct WatchProfile: Codable {
    let username: String
    let bio: String?
}

struct WatchArticlesResponse: Codable {
    let articles: [WatchArticle]
    let articlesCount: Int
}

struct WatchArticleResponse: Codable {
    let article: WatchArticle
}

struct WatchUser: Codable {
    let username: String
    let email: String
    let token: String
}

struct WatchUserResponse: Codable {
    let user: WatchUser
}

struct WatchErrorBody: Codable { let body: [String] }
struct WatchErrorResponse: Codable { let errors: WatchErrorBody }

// MARK: - Watch API Client

enum WatchAPIError: LocalizedError {
    case httpError(Int, String)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .httpError(_, let msg): return msg
        case .networkError(let err): return err.localizedDescription
        }
    }
}

@MainActor
class WatchAPIClient: ObservableObject {
    static let shared = WatchAPIClient()

    private let baseURL = "http://localhost:3000"
    private let session = URLSession.shared
    private let decoder = JSONDecoder()

    @Published var token: String? = nil

    var isAuthenticated: Bool { token != nil }

    private func request<T: Decodable>(_ method: String, path: String, body: Any? = nil) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw WatchAPIError.httpError(0, "Invalid URL")
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 15 // shorter timeout for watch

        if let token = token {
            req.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: req)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw WatchAPIError.httpError(0, "Invalid response")
        }

        if httpResponse.statusCode >= 400 {
            if let errorRes = try? decoder.decode(WatchErrorResponse.self, from: data) {
                throw WatchAPIError.httpError(httpResponse.statusCode, errorRes.errors.body.joined(separator: ", "))
            }
            throw WatchAPIError.httpError(httpResponse.statusCode, "HTTP \(httpResponse.statusCode)")
        }

        return try decoder.decode(T.self, from: data)
    }

    // Auth
    func login(email: String, password: String) async throws -> WatchUser {
        let body: [String: Any] = ["user": ["email": email, "password": password]]
        let res: WatchUserResponse = try await request("POST", path: "/api/users/login", body: body)
        token = res.user.token
        return res.user
    }

    // Articles (limited for watch)
    func getArticles() async throws -> [WatchArticle] {
        let res: WatchArticlesResponse = try await request("GET", path: "/api/articles")
        return res.articles
    }

    func getArticle(slug: String) async throws -> WatchArticle {
        let res: WatchArticleResponse = try await request("GET", path: "/api/articles/\(slug)")
        return res.article
    }

    // Favorite
    func favorite(slug: String) async throws -> WatchArticle {
        let res: WatchArticleResponse = try await request("POST", path: "/api/articles/\(slug)/favorite")
        return res.article
    }

    func unfavorite(slug: String) async throws -> WatchArticle {
        let res: WatchArticleResponse = try await request("DELETE", path: "/api/articles/\(slug)/favorite")
        return res.article
    }
}
