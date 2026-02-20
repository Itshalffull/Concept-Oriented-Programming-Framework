// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title JWT (On-Chain Token Registry)
/// @notice Concept-oriented token generation and verification
/// @dev Since traditional JWTs do not apply on-chain, this implements a simplified
///      token registry that maps users to unique tokens and supports reverse lookup.

contract JWT {
    // --- Storage ---

    /// @dev Maps user ID to their current token
    mapping(bytes32 => bytes32) private _tokens;

    /// @dev Reverse lookup: maps token to the user who owns it
    mapping(bytes32 => bytes32) private _tokenToUser;

    /// @dev Tracks whether a token is currently valid
    mapping(bytes32 => bool) private _validTokens;

    // --- Events ---

    event TokenGenerated(bytes32 indexed user, bytes32 token);
    event TokenVerified(bytes32 indexed token, bool valid, bytes32 user);

    // --- Actions ---

    /// @notice Generate a new token for a user, invalidating any previous token
    /// @param user The user ID to generate a token for
    /// @return token The newly generated token
    function generate(bytes32 user) external returns (bytes32 token) {
        require(user != bytes32(0), "User ID cannot be zero");

        // Invalidate the previous token if one exists
        bytes32 oldToken = _tokens[user];
        if (oldToken != bytes32(0)) {
            _validTokens[oldToken] = false;
            delete _tokenToUser[oldToken];
        }

        // Create a new token from user + block context
        token = keccak256(abi.encodePacked(user, block.timestamp, block.number, block.prevrandao));

        // Store both directions
        _tokens[user] = token;
        _tokenToUser[token] = user;
        _validTokens[token] = true;

        emit TokenGenerated(user, token);
        return token;
    }

    /// @notice Verify a token and return the associated user
    /// @param token The token to verify
    /// @return valid Whether the token is currently valid
    /// @return user The user ID associated with the token (bytes32(0) if invalid)
    function verify(bytes32 token) external view returns (bool valid, bytes32 user) {
        if (!_validTokens[token]) {
            return (false, bytes32(0));
        }
        return (true, _tokenToUser[token]);
    }

    /// @notice Revoke a user's current token
    /// @param user The user whose token should be revoked
    function revoke(bytes32 user) external {
        require(user != bytes32(0), "User ID cannot be zero");

        bytes32 token = _tokens[user];
        if (token != bytes32(0)) {
            _validTokens[token] = false;
            delete _tokenToUser[token];
            delete _tokens[user];
        }
    }

    /// @notice Get the current token for a user (if any)
    /// @param user The user ID
    /// @return hasToken Whether the user has an active token
    /// @return token The token value
    function getToken(bytes32 user) external view returns (bool hasToken, bytes32 token) {
        token = _tokens[user];
        if (token == bytes32(0)) {
            return (false, bytes32(0));
        }
        return (_validTokens[token], token);
    }
}
