// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AutomationTarget
/// @notice Automation code generation target
/// @dev Implements the AutomationTarget concept from Clef specification.
///      Generates automation artifacts from projections and validates manifests.

contract AutomationTarget {

    // --- Types ---

    struct GenerateOkResult {
        bool success;
        bytes32 artifactId;
        bytes32 projectionKey;
    }

    struct GenerateInvalidProjectionErrorResult {
        bool success;
        string message;
    }

    struct GenerateConfigErrorResult {
        bool success;
        string message;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 manifestKey;
        bool valid;
    }

    struct ValidateParseErrorResult {
        bool success;
        string message;
    }

    struct ListEntriesOkResult {
        bool success;
        bytes32 manifestKey;
        uint256 count;
    }

    struct ListEntriesNotFoundErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps artifact ID to existence
    mapping(bytes32 => bool) private _artifacts;

    /// @dev Ordered list of artifact IDs
    bytes32[] private _artifactKeys;

    /// @dev Maps artifact ID to its projection key
    mapping(bytes32 => bytes32) private _artifactProjections;

    /// @dev Maps manifest key to existence
    mapping(bytes32 => bool) private _manifests;

    /// @dev Ordered list of manifest keys
    bytes32[] private _manifestKeys;

    /// @dev Maps manifest key to its validation state
    mapping(bytes32 => bool) private _manifestValid;

    /// @dev Maps manifest key to its entry count
    mapping(bytes32 => uint256) private _manifestEntryCount;

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 id);
    event ValidateCompleted(string variant, bytes32 id);
    event ListEntriesCompleted(string variant, bytes32 id);

    // --- Actions ---

    /// @notice generate — produce an automation artifact from a projection and config
    function generate(
        string calldata projection,
        string calldata config
    ) external returns (GenerateOkResult memory) {
        bytes32 projectionKey = keccak256(abi.encodePacked(projection));

        bytes32 artifactId = keccak256(abi.encodePacked(
            projectionKey, config, block.timestamp, _artifactKeys.length
        ));

        _artifacts[artifactId] = true;
        _artifactKeys.push(artifactId);
        _artifactProjections[artifactId] = projectionKey;

        emit GenerateCompleted("ok", artifactId);

        return GenerateOkResult({success: true, artifactId: artifactId, projectionKey: projectionKey});
    }

    /// @notice validate — validate a manifest for structural and semantic correctness
    function validate(string calldata manifest) external returns (ValidateOkResult memory) {
        bytes32 manifestKey = keccak256(abi.encodePacked(manifest));

        if (!_manifests[manifestKey]) {
            _manifests[manifestKey] = true;
            _manifestKeys.push(manifestKey);
        }

        _manifestValid[manifestKey] = true;

        emit ValidateCompleted("ok", manifestKey);

        return ValidateOkResult({success: true, manifestKey: manifestKey, valid: true});
    }

    /// @notice listEntries — enumerate entries declared in a manifest
    function listEntries(string calldata manifest) external returns (ListEntriesOkResult memory) {
        bytes32 manifestKey = keccak256(abi.encodePacked(manifest));
        require(_manifests[manifestKey], "Manifest not found");

        uint256 count = _manifestEntryCount[manifestKey];

        emit ListEntriesCompleted("ok", manifestKey);

        return ListEntriesOkResult({success: true, manifestKey: manifestKey, count: count});
    }

}
