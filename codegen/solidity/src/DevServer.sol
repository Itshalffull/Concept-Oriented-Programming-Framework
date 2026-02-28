// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DevServer
/// @notice Development server manager for Clef projects
/// @dev Implements the DevServer concept from Clef specification.
///      Manages dev server sessions with start, stop, and status actions.
///      Sessions are tracked by unique ID with port and watch directory metadata.

contract DevServer {

    // --- Types ---

    struct SessionRecord {
        int256 port;
        string[] watchDirs;
        string url;
        uint256 startedAt;
        bool running;
        bool exists;
    }

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

    // --- Storage ---

    /// @dev Maps session ID to its SessionRecord
    mapping(bytes32 => SessionRecord) private _sessions;

    /// @dev Maps port number to session ID for port-in-use checks
    mapping(int256 => bytes32) private _portToSession;

    /// @dev Ordered list of all session IDs
    bytes32[] private _sessionIds;

    /// @dev Nonce for unique session ID generation
    uint256 private _nonce;

    // --- Events ---

    event StartCompleted(string variant, bytes32 session, int256 port);
    event StopCompleted(string variant, bytes32 session);
    event StatusCompleted(string variant, int256 port, int256 uptime);

    // --- Actions ---

    /// @notice start - starts a new dev server session on the given port
    /// @param port The port number for the dev server
    /// @param watchDirs The directories to watch for changes
    /// @return result The start result with session ID and URL
    function start(int256 port, string[] memory watchDirs) external returns (StartOkResult memory result) {
        require(port > 0, "Port must be positive");
        require(watchDirs.length > 0, "Watch dirs cannot be empty");

        // Check port is not already in use by a running session
        bytes32 existingSession = _portToSession[port];
        if (existingSession != bytes32(0) && _sessions[existingSession].running) {
            revert("Port already in use");
        }

        bytes32 sessionId = keccak256(abi.encodePacked(port, block.timestamp, _nonce));
        _nonce++;

        string memory url = string(abi.encodePacked("http://localhost:", _intToString(port)));

        _sessions[sessionId] = SessionRecord({
            port: port,
            watchDirs: watchDirs,
            url: url,
            startedAt: block.timestamp,
            running: true,
            exists: true
        });
        _portToSession[port] = sessionId;
        _sessionIds.push(sessionId);

        result = StartOkResult({
            success: true,
            session: sessionId,
            port: port,
            url: url
        });

        emit StartCompleted("ok", sessionId, port);
    }

    /// @notice stop - stops a running dev server session
    /// @param session The session ID to stop
    /// @return result The stop result confirming session was stopped
    function stop(bytes32 session) external returns (StopOkResult memory result) {
        require(_sessions[session].exists, "Session not found");
        require(_sessions[session].running, "Session not running");

        _sessions[session].running = false;
        _portToSession[_sessions[session].port] = bytes32(0);

        result = StopOkResult({
            success: true,
            session: session
        });

        emit StopCompleted("ok", session);
    }

    /// @notice status - returns the status of a dev server session
    /// @param session The session ID to check
    /// @return running Whether the session is currently running
    function status(bytes32 session) external returns (bool running) {
        require(_sessions[session].exists, "Session not found");

        SessionRecord storage rec = _sessions[session];
        running = rec.running;

        int256 uptime = 0;
        if (rec.running) {
            uptime = int256(block.timestamp - rec.startedAt);
        }

        emit StatusCompleted(rec.running ? "running" : "stopped", rec.port, uptime);
    }

    // --- Views ---

    /// @notice Retrieve session details by ID
    /// @param session The session ID to look up
    /// @return port The port number
    /// @return url The server URL
    /// @return running Whether the session is running
    function getSession(bytes32 session) external view returns (int256 port, string memory url, bool running) {
        require(_sessions[session].exists, "Session not found");
        SessionRecord storage rec = _sessions[session];
        return (rec.port, rec.url, rec.running);
    }

    /// @notice Check if a session exists
    /// @param session The session ID to check
    /// @return Whether the session exists
    function sessionExists(bytes32 session) external view returns (bool) {
        return _sessions[session].exists;
    }

    // --- Internal ---

    /// @dev Converts a positive int256 to its decimal string representation
    function _intToString(int256 value) internal pure returns (string memory) {
        require(value >= 0, "Negative values not supported");
        if (value == 0) return "0";
        uint256 temp = uint256(value);
        uint256 digits;
        uint256 tmp = temp;
        while (tmp != 0) {
            digits++;
            tmp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (temp != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(temp % 10)));
            temp /= 10;
        }
        return string(buffer);
    }

}
