// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Elevation
/// @notice Elevation/shadow management for defining depth levels with shadow specifications.
contract Elevation {

    // --- Storage ---

    struct ElevationEntry {
        int256 level;
        string shadow;
        uint256 createdAt;
    }

    mapping(bytes32 => ElevationEntry) private _elevations;
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _elevationKeys;

    // --- Types ---

    struct DefineOkResult {
        bool success;
        bytes32 elevation;
    }

    struct GetOkResult {
        bool success;
        bytes32 elevation;
        string shadow;
    }

    struct GenerateScaleOkResult {
        bool success;
        string shadows;
    }

    // --- Events ---

    event DefineCompleted(string variant, bytes32 indexed elevation);
    event GetCompleted(string variant, bytes32 indexed elevation);
    event GenerateScaleCompleted(string variant);

    // --- Actions ---

    /// @notice Define an elevation level with its shadow specification.
    function defineLevel(bytes32 elevation, int256 level, string memory shadow) external returns (DefineOkResult memory) {
        require(!_exists[elevation], "Elevation already defined");
        require(level >= 0 && level <= 5, "Level must be 0-5");
        require(bytes(shadow).length > 2, "Shadow spec required");

        _elevations[elevation] = ElevationEntry({
            level: level,
            shadow: shadow,
            createdAt: block.timestamp
        });
        _exists[elevation] = true;
        _elevationKeys.push(elevation);

        emit DefineCompleted("ok", elevation);
        return DefineOkResult({success: true, elevation: elevation});
    }

    /// @notice Get the shadow specification for an elevation level.
    function get(bytes32 elevation) external returns (GetOkResult memory) {
        require(_exists[elevation], "Elevation not found");

        emit GetCompleted("ok", elevation);
        return GetOkResult({success: true, elevation: elevation, shadow: _elevations[elevation].shadow});
    }

    /// @notice Generate a full elevation scale from a base color.
    function generateScale(string memory baseColor) external returns (GenerateScaleOkResult memory) {
        require(bytes(baseColor).length > 0, "Base color required");

        // Generate a scale of shadows based on the base color
        string memory shadows = string(abi.encodePacked(
            "0:none;1:", baseColor, "-light;2:", baseColor, "-medium;3:", baseColor,
            "-heavy;4:", baseColor, "-deep;5:", baseColor, "-max"
        ));

        emit GenerateScaleCompleted("ok");
        return GenerateScaleOkResult({success: true, shadows: shadows});
    }

}
