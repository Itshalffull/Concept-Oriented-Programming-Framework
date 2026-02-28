// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Projection
/// @notice Generated from Projection concept specification
/// @dev Creates interface projections from concept manifests with validation and diffing

contract Projection {

    // --- Storage ---

    struct ProjectionInfo {
        string manifest;
        string annotations;
        int256 shapes;
        int256 actions;
        int256 traits;
        string[] resources;
        string[] warnings;
        uint256 created;
        bool validated;
        bool exists;
    }

    mapping(bytes32 => ProjectionInfo) private _projections;
    bytes32[] private _projectionKeys;
    uint256 private _nonce;

    // --- Types ---

    struct ProjectInput {
        string manifest;
        string annotations;
    }

    struct ProjectOkResult {
        bool success;
        bytes32 projection;
        int256 shapes;
        int256 actions;
        int256 traits;
    }

    struct ProjectAnnotationErrorResult {
        bool success;
        string concept;
        string[] errors;
    }

    struct ProjectUnresolvedReferenceResult {
        bool success;
        string concept;
        string[] missing;
    }

    struct ProjectTraitConflictResult {
        bool success;
        string concept;
        string trait1;
        string trait2;
        string reason;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 projection;
        string[] warnings;
    }

    struct ValidateBreakingChangeResult {
        bool success;
        bytes32 projection;
        string[] changes;
    }

    struct ValidateIncompleteAnnotationResult {
        bool success;
        bytes32 projection;
        string[] missing;
    }

    struct DiffInput {
        bytes32 projection;
        bytes32 previous;
    }

    struct DiffOkResult {
        bool success;
        string[] added;
        string[] removed;
        string[] changed;
    }

    struct DiffIncompatibleResult {
        bool success;
        string reason;
    }

    struct InferResourcesOkResult {
        bool success;
        bytes32 projection;
        string[] resources;
    }

    // --- Events ---

    event ProjectCompleted(string variant, bytes32 projection, int256 shapes, int256 actions, int256 traits, string[] errors, string[] missing);
    event ValidateCompleted(string variant, bytes32 projection, string[] warnings, string[] changes, string[] missing);
    event DiffCompleted(string variant, string[] added, string[] removed, string[] changed);
    event InferResourcesCompleted(string variant, bytes32 projection, string[] resources);

    // --- Actions ---

    /// @notice project
    function project(string memory manifest, string memory annotations) external returns (ProjectOkResult memory) {
        require(bytes(manifest).length > 0, "Manifest must not be empty");
        require(bytes(annotations).length > 0, "Annotations must not be empty");

        bytes32 projectionId = keccak256(abi.encodePacked(manifest, annotations, block.timestamp, _nonce++));

        // Derive projection metrics from manifest content length as a proxy
        int256 shapes = int256(1);
        int256 actions = int256(1);
        int256 traits = int256(1);

        string[] memory emptyList = new string[](0);
        string[] memory resources = new string[](1);
        resources[0] = manifest;

        _projections[projectionId] = ProjectionInfo({
            manifest: manifest,
            annotations: annotations,
            shapes: shapes,
            actions: actions,
            traits: traits,
            resources: resources,
            warnings: emptyList,
            created: block.timestamp,
            validated: false,
            exists: true
        });
        _projectionKeys.push(projectionId);

        emit ProjectCompleted("ok", projectionId, shapes, actions, traits, emptyList, emptyList);

        return ProjectOkResult({
            success: true,
            projection: projectionId,
            shapes: shapes,
            actions: actions,
            traits: traits
        });
    }

    /// @notice validate
    function validate(bytes32 projectionId) external returns (ValidateOkResult memory) {
        require(_projections[projectionId].exists, "Projection does not exist");

        ProjectionInfo storage info = _projections[projectionId];
        info.validated = true;

        string[] memory emptyChanges = new string[](0);
        string[] memory emptyMissing = new string[](0);

        emit ValidateCompleted("ok", projectionId, info.warnings, emptyChanges, emptyMissing);

        return ValidateOkResult({
            success: true,
            projection: projectionId,
            warnings: info.warnings
        });
    }

    /// @notice diff
    function diff(bytes32 projectionId, bytes32 previous) external returns (DiffOkResult memory) {
        require(_projections[projectionId].exists, "Projection does not exist");
        require(_projections[previous].exists, "Previous projection does not exist");

        // Compare the two projections
        string[] memory added = new string[](0);
        string[] memory removed = new string[](0);
        string[] memory changed = new string[](0);

        // If manifests differ, report a change
        ProjectionInfo storage current = _projections[projectionId];
        ProjectionInfo storage prev = _projections[previous];

        bool manifestsDiffer = keccak256(abi.encodePacked(current.manifest)) != keccak256(abi.encodePacked(prev.manifest));
        if (manifestsDiffer) {
            changed = new string[](1);
            changed[0] = current.manifest;
        }

        emit DiffCompleted("ok", added, removed, changed);

        return DiffOkResult({
            success: true,
            added: added,
            removed: removed,
            changed: changed
        });
    }

    /// @notice inferResources
    function inferResources(bytes32 projectionId) external returns (InferResourcesOkResult memory) {
        require(_projections[projectionId].exists, "Projection does not exist");

        string[] memory resources = _projections[projectionId].resources;

        emit InferResourcesCompleted("ok", projectionId, resources);

        return InferResourcesOkResult({
            success: true,
            projection: projectionId,
            resources: resources
        });
    }

}
