// Conduit Example App -- SwiftUI User Model
// Codable data structures matching the Conduit REST API user responses.

import Foundation

struct User: Codable {
    let username: String
    let email: String
    let token: String
    let bio: String?
    let image: String?
}

struct UserResponse: Codable {
    let user: User
}

struct ErrorBody: Codable {
    let body: [String]
}

struct ErrorResponse: Codable {
    let errors: ErrorBody
}
