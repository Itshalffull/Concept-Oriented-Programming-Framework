// Conduit Example App -- SwiftUI Article Model
// Codable data structures matching the Conduit REST API article responses.

import Foundation

struct Article: Codable, Identifiable {
    var id: String { slug }
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

struct Profile: Codable {
    let username: String
    let bio: String?
    let image: String?
    var following: Bool
}

struct Comment: Codable, Identifiable {
    let id: String
    let body: String
    let createdAt: String
    let author: Profile
}

// API response wrappers
struct ArticleResponse: Codable {
    let article: Article
}

struct ArticlesResponse: Codable {
    let articles: [Article]
    let articlesCount: Int
}

struct CommentResponse: Codable {
    let comment: Comment
}

struct CommentsResponse: Codable {
    let comments: [Comment]
}

struct TagsResponse: Codable {
    let tags: [String]
}

struct ProfileResponse: Codable {
    let profile: Profile
}
