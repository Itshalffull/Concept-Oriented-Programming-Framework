// Conduit Example App -- AppKit API Client
// URLSession-based HTTP client for the Conduit REST API on macOS.

import Foundation

// MARK: - Models

struct User: Codable {
    let username: String
    let email: String
    let token: String
    let bio: String?
    let image: String?
}

struct Profile: Codable {
    let username: String
    let bio: String?
    let image: String?
    var following: Bool
}

struct Article: Codable {
    let slug: String
    let title: String
    let description: String
    let body: String
    let tagList: [String]
    let createdAt: String
    let updatedAt: String
    var favorited: Bool
    var favoritesCount: Int
    var author: Profile
}

struct Comment: Codable {
    let id: String
    let body: String
    let createdAt: String
    let author: Profile
}

struct UserResponse: Codable { let user: User }
struct ProfileResponse: Codable { let profile: Profile }
struct ArticleResponse: Codable { let article: Article }
struct ArticlesResponse: Codable { let articles: [Article]; let articlesCount: Int }
struct CommentResponse: Codable { let comment: Comment }
struct CommentsResponse: Codable { let comments: [Comment] }
struct TagsResponse: Codable { let tags: [String] }
struct ErrorBody: Codable { let body: [String] }
struct ErrorResponse: Codable { let errors: ErrorBody }

// MARK: - API Client

enum APIClientError: LocalizedError {
    case httpError(Int, String)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .httpError(_, let message): return message
        case .networkError(let error): return error.localizedDescription
        }
    }
}

class APIClient {
    static let shared = APIClient()

    private let baseURL = "http://localhost:3000"
    private let session = URLSession.shared
    private let decoder = JSONDecoder()

    var token: String?
    var currentUser: User?

    var isAuthenticated: Bool { token != nil }

    private func request<T: Decodable>(_ method: String, path: String, body: Any? = nil) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIClientError.httpError(0, "Invalid URL")
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token {
            req.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: req)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.httpError(0, "Invalid response")
        }

        if httpResponse.statusCode >= 400 {
            if let errorRes = try? decoder.decode(ErrorResponse.self, from: data) {
                throw APIClientError.httpError(httpResponse.statusCode, errorRes.errors.body.joined(separator: ", "))
            }
            throw APIClientError.httpError(httpResponse.statusCode, "HTTP \(httpResponse.statusCode)")
        }

        return try decoder.decode(T.self, from: data)
    }

    // Auth
    func login(email: String, password: String) async throws -> User {
        let body: [String: Any] = ["user": ["email": email, "password": password]]
        let res: UserResponse = try await request("POST", path: "/api/users/login", body: body)
        token = res.user.token
        currentUser = res.user
        return res.user
    }

    func register(username: String, email: String, password: String) async throws -> User {
        let body: [String: Any] = ["user": ["username": username, "email": email, "password": password]]
        let res: UserResponse = try await request("POST", path: "/api/users", body: body)
        token = res.user.token
        currentUser = res.user
        return res.user
    }

    func logout() { token = nil; currentUser = nil }

    // Articles
    func getArticles() async throws -> [Article] {
        let res: ArticlesResponse = try await request("GET", path: "/api/articles")
        return res.articles
    }

    func getArticle(slug: String) async throws -> Article {
        let res: ArticleResponse = try await request("GET", path: "/api/articles/\(slug)")
        return res.article
    }

    func deleteArticle(slug: String) async throws {
        let _: [String: String] = try await request("DELETE", path: "/api/articles/\(slug)")
    }

    // Comments
    func getComments(slug: String) async throws -> [Comment] {
        let res: CommentsResponse = try await request("GET", path: "/api/articles/\(slug)/comments")
        return res.comments
    }

    // Social
    func follow(username: String) async throws -> Profile {
        let res: ProfileResponse = try await request("POST", path: "/api/profiles/\(username)/follow")
        return res.profile
    }

    func unfollow(username: String) async throws -> Profile {
        let res: ProfileResponse = try await request("DELETE", path: "/api/profiles/\(username)/follow")
        return res.profile
    }

    func favorite(slug: String) async throws -> Article {
        let res: ArticleResponse = try await request("POST", path: "/api/articles/\(slug)/favorite")
        return res.article
    }

    func unfavorite(slug: String) async throws -> Article {
        let res: ArticleResponse = try await request("DELETE", path: "/api/articles/\(slug)/favorite")
        return res.article
    }

    // Profile
    func getProfile(username: String) async throws -> Profile {
        let res: ProfileResponse = try await request("GET", path: "/api/profiles/\(username)")
        return res.profile
    }
}
