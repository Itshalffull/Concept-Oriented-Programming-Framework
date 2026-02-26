// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Pathauto
/// @notice Concept-oriented automatic path alias generation from titles
/// @dev Implements the Pathauto concept from COPF specification.
///      Generates URL-friendly slugs from titles and stores them as aliases for nodes.

contract Pathauto {
    // --- Storage ---

    /// @dev Maps node ID to its generated slug alias
    mapping(bytes32 => string) private _aliases;

    /// @dev Tracks whether a node has an alias
    mapping(bytes32 => bool) private _hasAlias;

    // --- Events ---

    event AliasGenerated(bytes32 indexed nodeId, string slug);

    // --- Actions ---

    /// @notice Generate and store a URL-friendly alias from a title
    /// @param nodeId The node ID to generate an alias for
    /// @param title The title to slugify
    function generateAlias(bytes32 nodeId, string calldata title) external {
        require(nodeId != bytes32(0), "Node ID cannot be zero");
        require(bytes(title).length > 0, "Title cannot be empty");

        string memory slug = _slugify(title);
        _aliases[nodeId] = slug;
        _hasAlias[nodeId] = true;

        emit AliasGenerated(nodeId, slug);
    }

    // --- Views ---

    /// @notice Get the alias for a node
    /// @param nodeId The node ID
    /// @return found Whether an alias exists
    /// @return slug The generated slug
    function getAlias(bytes32 nodeId) external view returns (bool found, string memory slug) {
        if (!_hasAlias[nodeId]) {
            return (false, "");
        }
        return (true, _aliases[nodeId]);
    }

    /// @notice Check if a node has an alias
    /// @param nodeId The node ID
    /// @return Whether an alias has been generated
    function hasAlias(bytes32 nodeId) external view returns (bool) {
        return _hasAlias[nodeId];
    }

    // --- Internal ---

    /// @dev Convert a title string to a URL-friendly slug
    ///      Lowercases ASCII letters and replaces spaces with hyphens.
    ///      Non-alphanumeric, non-space characters are stripped.
    /// @param title The input title
    /// @return The slugified string
    function _slugify(string memory title) internal pure returns (string memory) {
        bytes memory titleBytes = bytes(title);
        bytes memory slugBytes = new bytes(titleBytes.length);
        uint256 slugLen = 0;

        for (uint256 i = 0; i < titleBytes.length; i++) {
            bytes1 c = titleBytes[i];

            if (c == 0x20) {
                // Space -> hyphen, but avoid leading/consecutive hyphens
                if (slugLen > 0 && slugBytes[slugLen - 1] != 0x2D) {
                    slugBytes[slugLen] = 0x2D; // '-'
                    slugLen++;
                }
            } else if (c >= 0x41 && c <= 0x5A) {
                // Uppercase A-Z -> lowercase a-z
                slugBytes[slugLen] = bytes1(uint8(c) + 32);
                slugLen++;
            } else if (c >= 0x61 && c <= 0x7A) {
                // Lowercase a-z
                slugBytes[slugLen] = c;
                slugLen++;
            } else if (c >= 0x30 && c <= 0x39) {
                // Digits 0-9
                slugBytes[slugLen] = c;
                slugLen++;
            }
            // All other characters are stripped
        }

        // Remove trailing hyphen
        if (slugLen > 0 && slugBytes[slugLen - 1] == 0x2D) {
            slugLen--;
        }

        // Trim the bytes array to actual length
        bytes memory result = new bytes(slugLen);
        for (uint256 i = 0; i < slugLen; i++) {
            result[i] = slugBytes[i];
        }

        return string(result);
    }
}
