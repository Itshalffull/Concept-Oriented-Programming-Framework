// Conduit Example App -- SwiftUI API Service
// URLSession-based HTTP client for the Conduit REST API.

import Foundation

enum APIError: LocalizedError {
    case httpError(Int, String)
    case networkError(Error)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .httpError(_, let message): return message
        case .networkError(let error): return error.localizedDescription
        case .decodingError(let error): return "Decoding error: \(error.localizedDescription)"
        }
    }
}

@MainActor
class APIService: ObservableObject {
    static let shared = APIService()

    private let baseURL = "http://localhost:3000"
    private let session = URLSession.shared
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()

    @Published var token: String? = nil
    @Published var currentUser: User? = nil

    var isAuthenticated: Bool { token != nil }

    // MARK: - Generic Request

    private func request<T: Decodable>(_ method: String, path: String, body: Any? = nil) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.httpError(0, "Invalid URL")
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
            throw APIError.httpError(0, "Invalid response")
        }

        if httpResponse.statusCode >= 400 {
            if let errorRes = try? decoder.decode(ErrorResponse.self, from: data) {
                throw APIError.httpError(httpResponse.statusCode, errorRes.errors.body.joined(separator: ", "))
            }
            throw APIError.httpError(httpResponse.statusCode, "HTTP \(httpResponse.statusCode)")
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Auth

    func register(username: String, email: String, password: String) async throws -> User {
        let body: [String: Any] = ["user": ["username": username, "email": email, "password": password]]
        let res: UserResponse = try await request("POST", path: "/api/users", body: body)
        token = res.user.token
        currentUser = res.user
        return res.user
    }

    func login(email: String, password: String) async throws -> User {
        let body: [String: Any] = ["user": ["email": email, "password": password]]
        let res: UserResponse = try await request("POST", path: "/api/users/login", body: body)
        token = res.user.token
        currentUser = res.user
        return res.user
    }

    func logout() {
        token = nil
        currentUser = nil
    }

    // MARK: - Profile

    func getProfile(username: String) async throws -> Profile {
        let res: ProfileResponse = try await request("GET", path: "/api/profiles/\(username)")
        return res.profile
    }

    func updateProfile(bio: String?, image: String?) async throws -> User {
        var userDict: [String: String] = [:]
        if let bio = bio { userDict["bio"] = bio }
        if let image = image { userDict["image"] = image }
        let res: UserResponse = try await request("PUT", path: "/api/user", body: ["user": userDict])
        currentUser = res.user
        return res.user
    }

    // MARK: - Articles

    func getArticles() async throws -> [Article] {
        let res: ArticlesResponse = try await request("GET", path: "/api/articles")
        return res.articles
    }

    func getArticle(slug: String) async throws -> Article {
        let res: ArticleResponse = try await request("GET", path: "/api/articles/\(slug)")
        return res.article
    }

    func createArticle(title: String, description: String, body: String, tagList: [String]?) async throws -> Article {
        var articleDict: [String: Any] = ["title": title, "description": description, "body": body]
        if let tags = tagList { articleDict["tagList"] = tags }
        let res: ArticleResponse = try await request("POST", path: "/api/articles", body: ["article": articleDict])
        return res.article
    }

    func deleteArticle(slug: String) async throws {
        let _: [String: String] = try await request("DELETE", path: "/api/articles/\(slug)")
    }

    // MARK: - Comments

    func getComments(slug: String) async throws -> [Comment] {
        let res: CommentsResponse = try await request("GET", path: "/api/articles/\(slug)/comments")
        return res.comments
    }

    func createComment(slug: String, body: String) async throws -> Comment {
        let res: CommentResponse = try await request("POST", path: "/api/articles/\(slug)/comments", body: ["comment": ["body": body]])
        return res.comment
    }

    func deleteComment(slug: String, commentId: String) async throws {
        let _: [String: String] = try await request("DELETE", path: "/api/articles/\(slug)/comments/\(commentId)")
    }

    // MARK: - Social

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

    // MARK: - Tags

    func getTags() async throws -> [String] {
        let res: TagsResponse = try await request("GET", path: "/api/tags")
        return res.tags
    }
}
