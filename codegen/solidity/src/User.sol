// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title User
/// @notice Concept-oriented User registration with name and email uniqueness
/// @dev Implements the User concept from Clef specification

contract User {
    // --- Storage ---

    /// @dev Tracks whether a user ID has been registered
    mapping(bytes32 => bool) private _exists;

    /// @dev Maps a user name to its user ID (for uniqueness checks)
    mapping(string => bytes32) private _nameToUser;

    /// @dev Maps an email to its user ID (for uniqueness checks)
    mapping(string => bytes32) private _emailToUser;

    /// @dev Maps user ID to the stored name
    mapping(bytes32 => string) private _names;

    /// @dev Maps user ID to the stored email
    mapping(bytes32 => string) private _emails;

    // --- Events ---

    event Registered(bytes32 indexed user, string name, string email);
    event RegisterFailed(string reason);

    // --- Actions ---

    /// @notice Register a new user with a unique name and email
    /// @param user The unique identifier for this user
    /// @param name The display name (must be unique across all users)
    /// @param email The email address (must be unique across all users)
    /// @return success Whether registration succeeded
    /// @return userId The registered user's ID (same as input on success, bytes32(0) on failure)
    function register(bytes32 user, string calldata name, string calldata email)
        external
        returns (bool success, bytes32 userId)
    {
        // Validate inputs are non-empty
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(email).length > 0, "Email cannot be empty");
        require(user != bytes32(0), "User ID cannot be zero");

        // Check user ID not already registered
        if (_exists[user]) {
            emit RegisterFailed("User ID already exists");
            return (false, bytes32(0));
        }

        // Check name uniqueness
        if (_nameToUser[name] != bytes32(0)) {
            emit RegisterFailed("Name already taken");
            return (false, bytes32(0));
        }

        // Check email uniqueness
        if (_emailToUser[email] != bytes32(0)) {
            emit RegisterFailed("Email already taken");
            return (false, bytes32(0));
        }

        // Store all mappings
        _exists[user] = true;
        _nameToUser[name] = user;
        _emailToUser[email] = user;
        _names[user] = name;
        _emails[user] = email;

        emit Registered(user, name, email);
        return (true, user);
    }

    // --- View helpers ---

    /// @notice Look up a user by name
    /// @param name The name to search for
    /// @return found Whether a user was found
    /// @return user The user ID if found
    function getByName(string calldata name) external view returns (bool found, bytes32 user) {
        bytes32 userId = _nameToUser[name];
        if (userId == bytes32(0)) {
            return (false, bytes32(0));
        }
        return (true, userId);
    }

    /// @notice Look up a user by email
    /// @param email The email to search for
    /// @return found Whether a user was found
    /// @return user The user ID if found
    function getByEmail(string calldata email) external view returns (bool found, bytes32 user) {
        bytes32 userId = _emailToUser[email];
        if (userId == bytes32(0)) {
            return (false, bytes32(0));
        }
        return (true, userId);
    }

    /// @notice Get user details by ID
    /// @param user The user ID
    /// @return exists_ Whether the user exists
    /// @return name The user's name
    /// @return email The user's email
    function get(bytes32 user) external view returns (bool exists_, string memory name, string memory email) {
        if (!_exists[user]) {
            return (false, "", "");
        }
        return (true, _names[user], _emails[user]);
    }
}
