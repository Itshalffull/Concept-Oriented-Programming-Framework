// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Password
/// @notice Concept-oriented password hashing and verification
/// @dev Implements the Password concept from COPF specification.
///      Uses keccak256 with per-user salts for password storage.

contract Password {
    // --- Storage ---

    /// @dev Stores the hash of (password + salt) for each user
    mapping(bytes32 => bytes32) private _hashes;

    /// @dev Stores the salt used during hashing for each user
    mapping(bytes32 => bytes32) private _salts;

    /// @dev Tracks whether a user has set credentials
    mapping(bytes32 => bool) private _hasCredentials;

    // --- Events ---

    event PasswordSet(bytes32 indexed user);
    event PasswordSetFailed(bytes32 indexed user, string reason);
    event PasswordChecked(bytes32 indexed user, bool valid);

    // --- Constants ---

    uint256 private constant MIN_PASSWORD_LENGTH = 8;

    // --- Actions ---

    /// @notice Set (or reset) a password for a user
    /// @param user The user ID to set the password for
    /// @param password The plaintext password (will be hashed before storage)
    /// @return success Whether the password was set successfully
    function set(bytes32 user, string calldata password) external returns (bool success) {
        require(user != bytes32(0), "User ID cannot be zero");

        // Validate password length
        if (bytes(password).length < MIN_PASSWORD_LENGTH) {
            emit PasswordSetFailed(user, "Password must be at least 8 characters");
            return false;
        }

        // Generate a salt from block context and user
        bytes32 salt = keccak256(abi.encodePacked(block.timestamp, block.prevrandao, user, blockhash(block.number - 1)));

        // Hash the password with the salt
        bytes32 hash = keccak256(abi.encodePacked(password, salt));

        // Store credentials
        _hashes[user] = hash;
        _salts[user] = salt;
        _hasCredentials[user] = true;

        emit PasswordSet(user);
        return true;
    }

    /// @notice Check a password against the stored hash
    /// @param user The user ID to check
    /// @param password The plaintext password to verify
    /// @return valid Whether the password matches
    function check(bytes32 user, string calldata password) external view returns (bool valid) {
        // If user has no credentials, return false
        if (!_hasCredentials[user]) {
            return false;
        }

        // Retrieve the salt and recompute the hash
        bytes32 salt = _salts[user];
        bytes32 computedHash = keccak256(abi.encodePacked(password, salt));

        return computedHash == _hashes[user];
    }

    /// @notice Validate password meets minimum requirements (pure function)
    /// @param password The password to validate
    /// @return valid Whether the password meets minimum length requirements
    function validate(string calldata password) external pure returns (bool valid) {
        return bytes(password).length >= MIN_PASSWORD_LENGTH;
    }

    /// @notice Check whether a user has stored credentials
    /// @param user The user ID
    /// @return Whether the user has a password set
    function hasPassword(bytes32 user) external view returns (bool) {
        return _hasCredentials[user];
    }
}
