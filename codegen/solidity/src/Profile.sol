// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Profile
/// @notice Concept-oriented user profile management
/// @dev Implements the Profile concept from Clef specification.
///      Stores bio and image URL for each user.

contract Profile {
    // --- Storage ---

    /// @dev Maps user ID to their bio text
    mapping(bytes32 => string) private _bios;

    /// @dev Maps user ID to their image URL
    mapping(bytes32 => string) private _images;

    /// @dev Tracks whether a profile has been created
    mapping(bytes32 => bool) private _exists;

    // --- Events ---

    event ProfileUpdated(bytes32 indexed user, string bio, string image);

    // --- Actions ---

    /// @notice Create or update a user's profile
    /// @param user The user ID
    /// @param bio The bio text
    /// @param image The profile image URL
    function update(bytes32 user, string calldata bio, string calldata image) external {
        require(user != bytes32(0), "User ID cannot be zero");

        _bios[user] = bio;
        _images[user] = image;
        _exists[user] = true;

        emit ProfileUpdated(user, bio, image);
    }

    /// @notice Get a user's profile
    /// @param user The user ID
    /// @return found Whether the profile exists
    /// @return bio The bio text (empty string if not found)
    /// @return image The image URL (empty string if not found)
    function get(bytes32 user) external view returns (bool found, string memory bio, string memory image) {
        if (!_exists[user]) {
            return (false, "", "");
        }
        return (true, _bios[user], _images[user]);
    }
}
