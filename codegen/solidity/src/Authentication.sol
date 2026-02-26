// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Authentication
/// @notice Concept-oriented credential-based authentication with register, login, logout, and password reset
/// @dev Implements the Authentication concept from Clef specification.
///      Stores credential hashes on-chain; actual password hashing should occur off-chain.

contract Authentication {
    // --- Types ---

    struct Account {
        bytes32 credentialHash;
        bool active;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps user ID to their account data
    mapping(bytes32 => Account) private _accounts;

    // --- Events ---

    event Registered(bytes32 indexed userId);
    event LoggedIn(bytes32 indexed userId);
    event LoggedOut(bytes32 indexed userId);
    event PasswordReset(bytes32 indexed userId);

    // --- Actions ---

    /// @notice Register a new account with a credential hash
    /// @param userId The unique user identifier
    /// @param credentialHash The hashed credential (password hash)
    function register(bytes32 userId, bytes32 credentialHash) external {
        require(userId != bytes32(0), "User ID cannot be zero");
        require(credentialHash != bytes32(0), "Credential hash cannot be zero");
        require(!_accounts[userId].exists, "Account already registered");

        _accounts[userId] = Account({
            credentialHash: credentialHash,
            active: false,
            exists: true
        });

        emit Registered(userId);
    }

    /// @notice Authenticate a user by verifying their credential hash
    /// @param userId The user ID attempting to log in
    /// @param credentialHash The credential hash to verify
    /// @return success Whether authentication succeeded
    function login(bytes32 userId, bytes32 credentialHash) external returns (bool success) {
        require(_accounts[userId].exists, "Account not found");

        if (_accounts[userId].credentialHash != credentialHash) {
            return false;
        }

        _accounts[userId].active = true;

        emit LoggedIn(userId);
        return true;
    }

    /// @notice Log out a user (mark session as inactive)
    /// @param userId The user ID to log out
    function logout(bytes32 userId) external {
        require(_accounts[userId].exists, "Account not found");

        _accounts[userId].active = false;

        emit LoggedOut(userId);
    }

    /// @notice Reset a user's credential hash
    /// @param userId The user whose password to reset
    /// @param newCredentialHash The new credential hash
    function resetPassword(bytes32 userId, bytes32 newCredentialHash) external {
        require(_accounts[userId].exists, "Account not found");
        require(newCredentialHash != bytes32(0), "Credential hash cannot be zero");

        _accounts[userId].credentialHash = newCredentialHash;

        emit PasswordReset(userId);
    }

    // --- View ---

    /// @notice Check if an account is registered
    /// @param userId The user ID to check
    /// @return Whether the account exists
    function isRegistered(bytes32 userId) external view returns (bool) {
        return _accounts[userId].exists;
    }
}
