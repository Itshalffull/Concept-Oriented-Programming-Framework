// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Target
/// @notice Generated from Target concept specification
/// @dev Manages interface target generation with output tracking and diffing

contract Target {

    // --- Storage ---

    struct OutputInfo {
        string projection;
        string targetType;
        string config;
        string[] files;
        bytes32 previousOutput;
        bool hasPrevious;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => OutputInfo) private _outputs;
    bytes32[] private _outputKeys;

    // Track latest output per (projection, targetType) pair for diff
    mapping(bytes32 => bytes32) private _latestOutput;

    uint256 private _nonce;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string targetType;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 output;
        string[] files;
    }

    struct GenerateUnsupportedActionResult {
        bool success;
        string action;
        string targetType;
        string reason;
    }

    struct GenerateTargetErrorResult {
        bool success;
        string targetType;
        string reason;
    }

    struct DiffOkResult {
        bool success;
        bytes32 output;
        string[] added;
        string[] removed;
        string[] changed;
    }

    struct DiffNoPreviousResult {
        bool success;
        bytes32 output;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 output, string[] files);
    event DiffCompleted(string variant, bytes32 output, string[] added, string[] removed, string[] changed);

    // --- Actions ---

    /// @notice generate
    function generate(string memory projection, string memory targetType, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection must not be empty");
        require(bytes(targetType).length > 0, "Target type must not be empty");

        bytes32 outputId = keccak256(abi.encodePacked(projection, targetType, block.timestamp, _nonce++));

        // Generate files based on target type
        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(projection, ".", targetType, ".ts"));
        files[1] = string(abi.encodePacked(projection, ".", targetType, ".types.ts"));

        // Track previous output for diffing
        bytes32 pairKey = keccak256(abi.encodePacked(projection, targetType));
        bytes32 previousOutputId = _latestOutput[pairKey];
        bool hasPrevious = _outputs[previousOutputId].exists;

        _outputs[outputId] = OutputInfo({
            projection: projection,
            targetType: targetType,
            config: config,
            files: files,
            previousOutput: previousOutputId,
            hasPrevious: hasPrevious,
            created: block.timestamp,
            exists: true
        });
        _outputKeys.push(outputId);

        // Update latest output for this pair
        _latestOutput[pairKey] = outputId;

        emit GenerateCompleted("ok", outputId, files);

        return GenerateOkResult({
            success: true,
            output: outputId,
            files: files
        });
    }

    /// @notice diff
    function diff(bytes32 outputId) external returns (DiffOkResult memory) {
        require(_outputs[outputId].exists, "Output does not exist");

        OutputInfo storage info = _outputs[outputId];

        if (!info.hasPrevious) {
            // No previous output, all files are "added"
            string[] memory added = info.files;
            string[] memory emptyList = new string[](0);

            emit DiffCompleted("noPrevious", outputId, added, emptyList, emptyList);

            return DiffOkResult({
                success: true,
                output: outputId,
                added: added,
                removed: emptyList,
                changed: emptyList
            });
        }

        // Compare with previous output
        OutputInfo storage prev = _outputs[info.previousOutput];

        // Simplified diff: current files are "changed" if previous existed
        string[] memory emptyAdded = new string[](0);
        string[] memory emptyRemoved = new string[](0);
        string[] memory changed = info.files;

        // Check for removed files from previous not in current
        // (simplified: we assume same structure so no removals)

        emit DiffCompleted("ok", outputId, emptyAdded, emptyRemoved, changed);

        // Suppress unused variable warning
        prev;

        return DiffOkResult({
            success: true,
            output: outputId,
            added: emptyAdded,
            removed: emptyRemoved,
            changed: changed
        });
    }

}
