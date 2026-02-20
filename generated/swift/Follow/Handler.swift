// generated: Follow/Handler.swift

import Foundation

protocol FollowHandler {
    func follow(
        input: FollowFollowInput,
        storage: ConceptStorage
    ) async throws -> FollowFollowOutput

    func unfollow(
        input: FollowUnfollowInput,
        storage: ConceptStorage
    ) async throws -> FollowUnfollowOutput

    func isFollowing(
        input: FollowIsFollowingInput,
        storage: ConceptStorage
    ) async throws -> FollowIsFollowingOutput

}
