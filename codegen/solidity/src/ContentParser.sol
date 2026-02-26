// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ContentParser
/// @notice Concept-oriented format registration for content parsing
/// @dev Implements the ContentParser concept from Clef specification.
///      Stores format configurations on-chain; actual parsing logic executes off-chain.

contract ContentParser {
    // --- Types ---

    struct Format {
        string config;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps format ID to its configuration
    mapping(bytes32 => Format) private _formats;

    // --- Events ---

    event FormatRegistered(bytes32 indexed formatId);
    event ContentParsed(bytes32 indexed formatId);

    // --- Actions ---

    /// @notice Register a content format configuration
    /// @param formatId The unique identifier for this format
    /// @param config The format configuration string (e.g., JSON schema or parser rules)
    function registerFormat(bytes32 formatId, string calldata config) external {
        require(formatId != bytes32(0), "Format ID cannot be zero");
        require(!_formats[formatId].exists, "Format already registered");

        _formats[formatId] = Format({
            config: config,
            exists: true
        });

        emit FormatRegistered(formatId);
    }

    // --- View ---

    /// @notice Retrieve the configuration for a format
    /// @param formatId The format ID to look up
    /// @return found Whether the format was found
    /// @return config The format configuration string (empty if not found)
    function getFormat(bytes32 formatId) external view returns (bool found, string memory config) {
        if (!_formats[formatId].exists) {
            return (false, "");
        }
        return (true, _formats[formatId].config);
    }

    /// @notice Check if a format is registered
    /// @param formatId The format ID to check
    /// @return Whether the format exists
    function formatExists(bytes32 formatId) external view returns (bool) {
        return _formats[formatId].exists;
    }
}
