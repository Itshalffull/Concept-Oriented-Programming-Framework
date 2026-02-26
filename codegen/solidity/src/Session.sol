// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Session
/// @notice Concept-oriented session management with creation, validation, refresh, and destruction
/// @dev Implements the Session concept from Clef specification.
///      Supports time-bounded sessions with device info and per-user session tracking.

contract Session {
    // --- Types ---

    struct SessionData {
        bytes32 userId;
        string deviceInfo;
        uint256 createdAt;
        uint256 expiresAt;
        bool active;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps session ID to its data
    mapping(bytes32 => SessionData) private _sessions;

    /// @dev Maps user ID to list of their session IDs
    mapping(bytes32 => bytes32[]) private _userSessions;

    // --- Events ---

    event Created(bytes32 indexed sessionId, bytes32 indexed userId);
    event Destroyed(bytes32 indexed sessionId);
    event Refreshed(bytes32 indexed sessionId);

    // --- Actions ---

    /// @notice Create a new session for a user
    /// @param sessionId The unique session identifier
    /// @param userId The user this session belongs to
    /// @param deviceInfo A string describing the device or client
    /// @param duration The session duration in seconds from now
    function create(
        bytes32 sessionId,
        bytes32 userId,
        string calldata deviceInfo,
        uint256 duration
    ) external {
        require(sessionId != bytes32(0), "Session ID cannot be zero");
        require(userId != bytes32(0), "User ID cannot be zero");
        require(!_sessions[sessionId].exists, "Session already exists");
        require(duration > 0, "Duration must be positive");

        _sessions[sessionId] = SessionData({
            userId: userId,
            deviceInfo: deviceInfo,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration,
            active: true,
            exists: true
        });

        _userSessions[userId].push(sessionId);

        emit Created(sessionId, userId);
    }

    /// @notice Validate a session (check if it exists, is active, and not expired)
    /// @param sessionId The session to validate
    /// @return valid Whether the session is currently valid
    /// @return userId The user ID associated with the session (bytes32(0) if invalid)
    function validate(bytes32 sessionId) external view returns (bool valid, bytes32 userId) {
        SessionData storage session = _sessions[sessionId];

        if (!session.exists || !session.active || block.timestamp > session.expiresAt) {
            return (false, bytes32(0));
        }

        return (true, session.userId);
    }

    /// @notice Refresh a session by extending its expiration
    /// @param sessionId The session to refresh
    /// @param newDuration The new duration in seconds from now
    function refresh(bytes32 sessionId, uint256 newDuration) external {
        require(_sessions[sessionId].exists, "Session not found");
        require(_sessions[sessionId].active, "Session is not active");
        require(newDuration > 0, "Duration must be positive");

        _sessions[sessionId].expiresAt = block.timestamp + newDuration;

        emit Refreshed(sessionId);
    }

    /// @notice Destroy (deactivate) a session
    /// @param sessionId The session to destroy
    function destroy(bytes32 sessionId) external {
        require(_sessions[sessionId].exists, "Session not found");

        _sessions[sessionId].active = false;

        emit Destroyed(sessionId);
    }
}
