// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DevServer
/// @notice Generated from DevServer concept specification
/// @dev Skeleton contract — implement action bodies

contract DevServer {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private entries;

    // sessions
    mapping(bytes32 => bool) private sessions;
    bytes32[] private sessionsKeys;

    // --- Types ---

    struct StartInput {
        int256 port;
        string[] watchDirs;
    }

    struct StartOkResult {
        bool success;
        bytes32 session;
        int256 port;
        string url;
    }

    struct StartPortInUseResult {
        bool success;
        int256 port;
    }

    struct StopOkResult {
        bool success;
        bytes32 session;
    }

    struct StatusRunningResult {
        bool success;
        int256 port;
        int256 uptime;
        string lastRecompile;
    }

    // --- Events ---

    event StartCompleted(string variant, bytes32 session, int256 port);
    event StopCompleted(string variant, bytes32 session);
    event StatusCompleted(string variant, int256 port, int256 uptime);

    // --- Actions ---

    /// @notice start
    function start(int256 port, string[] memory watchDirs) external returns (StartOkResult memory) {
        // Invariant checks
        // invariant 1: after start, stop behaves correctly

        // TODO: Implement start
        revert("Not implemented");
    }

    /// @notice stop
    function stop(bytes32 session) external returns (StopOkResult memory) {
        // Invariant checks
        // invariant 1: after start, stop behaves correctly
        // require(..., "invariant 1: after start, stop behaves correctly");

        // TODO: Implement stop
        revert("Not implemented");
    }

    /// @notice status
    function status(bytes32 session) external returns (bool) {
        // TODO: Implement status
        revert("Not implemented");
    }

}
