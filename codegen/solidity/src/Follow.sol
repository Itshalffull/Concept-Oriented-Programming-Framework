// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Follow
/// @notice Concept-oriented follow/unfollow relationship management
/// @dev Implements the Follow concept from COPF specification.
///      Tracks directional following relationships between users.

contract Follow {
    // --- Storage ---

    /// @dev Maps follower => target => whether following
    mapping(bytes32 => mapping(bytes32 => bool)) private _following;

    // --- Events ---

    event Followed(bytes32 indexed user, bytes32 indexed target);
    event Unfollowed(bytes32 indexed user, bytes32 indexed target);

    // --- Actions ---

    /// @notice Follow a target user
    /// @param user The user who is following
    /// @param target The user being followed
    function follow(bytes32 user, bytes32 target) external {
        require(user != bytes32(0), "User cannot be zero");
        require(target != bytes32(0), "Target cannot be zero");
        require(user != target, "Cannot follow yourself");
        require(!_following[user][target], "Already following");

        _following[user][target] = true;

        emit Followed(user, target);
    }

    /// @notice Unfollow a target user
    /// @param user The user who is unfollowing
    /// @param target The user being unfollowed
    function unfollow(bytes32 user, bytes32 target) external {
        require(_following[user][target], "Not following");

        _following[user][target] = false;

        emit Unfollowed(user, target);
    }

    /// @notice Check if a user is following a target
    /// @param user The potential follower
    /// @param target The potential followee
    /// @return Whether user is following target
    function isFollowing(bytes32 user, bytes32 target) external view returns (bool) {
        return _following[user][target];
    }
}
