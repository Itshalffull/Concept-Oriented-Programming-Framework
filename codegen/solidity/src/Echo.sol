// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Echo
/// @notice Concept-oriented echo (ping/pong) service
/// @dev Implements the Echo concept from Clef specification.
///      Stores a message and echoes it back, serving as a health-check pattern.

contract Echo {
    // --- Storage ---

    /// @dev Maps message ID to the stored text
    mapping(bytes32 => string) private _messages;

    // --- Events ---

    event Echoed(bytes32 indexed id, string text);

    // --- Actions ---

    /// @notice Send a message and receive it back (echo)
    /// @param id Unique identifier for this echo message
    /// @param text The text to echo
    /// @return The echoed text (same as input)
    function send(bytes32 id, string calldata text) external returns (string memory) {
        require(id != bytes32(0), "ID cannot be zero");
        require(bytes(text).length > 0, "Text cannot be empty");

        _messages[id] = text;

        emit Echoed(id, text);

        return text;
    }

    /// @notice Retrieve a previously echoed message
    /// @param id The message ID
    /// @return The stored text
    function getMessage(bytes32 id) external view returns (string memory) {
        return _messages[id];
    }
}
