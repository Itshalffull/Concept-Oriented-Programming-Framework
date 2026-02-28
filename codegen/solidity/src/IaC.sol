// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IaC
/// @notice Infrastructure as Code management with plan/apply/teardown lifecycle and drift detection.
/// @dev Tracks infrastructure resources through emit, preview, apply, and teardown operations.

contract IaC {

    // --- Storage ---

    struct ResourceEntry {
        string name;
        string provider;
        string resourceType;
        string status; // "planned", "created", "updated", "deleted", "drifted"
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    mapping(bytes32 => ResourceEntry) private _resources;
    bytes32[] private _resourceIds;
    mapping(bytes32 => bool) private _resourceExists;

    // Plan tracking
    struct PlanRecord {
        string plan;
        string provider;
        string output;
        int256 fileCount;
        bool emitted;
        bool applied;
        uint256 createdAt;
    }

    mapping(bytes32 => PlanRecord) private _plans;
    mapping(bytes32 => bool) private _planExists;

    // --- Types ---

    struct EmitInput {
        string plan;
        string provider;
    }

    struct EmitOkResult {
        bool success;
        string output;
        int256 fileCount;
    }

    struct EmitUnsupportedResourceResult {
        bool success;
        string resource;
        string provider;
    }

    struct PreviewInput {
        string plan;
        string provider;
    }

    struct PreviewOkResult {
        bool success;
        string[] toCreate;
        string[] toUpdate;
        string[] toDelete;
        uint256 estimatedMonthlyCost;
    }

    struct PreviewStateCorruptedResult {
        bool success;
        string provider;
        string reason;
    }

    struct ApplyInput {
        string plan;
        string provider;
    }

    struct ApplyOkResult {
        bool success;
        string[] created;
        string[] updated;
        string[] deleted;
    }

    struct ApplyPartialResult {
        bool success;
        string[] created;
        string[] failed;
        string reason;
    }

    struct ApplyApplyFailedResult {
        bool success;
        string reason;
    }

    struct DetectDriftOkResult {
        bool success;
        string[] drifted;
        string[] clean;
    }

    struct TeardownInput {
        string plan;
        string provider;
    }

    struct TeardownOkResult {
        bool success;
        string[] destroyed;
    }

    struct TeardownPartialResult {
        bool success;
        string[] destroyed;
        string[] stuck;
    }

    // --- Events ---

    event EmitCompleted(string variant, int256 fileCount);
    event PreviewCompleted(string variant, string[] toCreate, string[] toUpdate, string[] toDelete, uint256 estimatedMonthlyCost);
    event ApplyCompleted(string variant, string[] created, string[] updated, string[] deleted, string[] failed);
    event DetectDriftCompleted(string variant, string[] drifted, string[] clean);
    event TeardownCompleted(string variant, string[] destroyed, string[] stuck);

    // --- Actions ---

    /// @notice emitIaC - Generates IaC configuration files for a deployment plan.
    /// @dev Named emitIaC to avoid collision with Solidity's emit keyword.
    function emitIaC(string memory plan, string memory provider) external returns (EmitOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");
        require(bytes(provider).length > 0, "Provider must not be empty");

        bytes32 planId = keccak256(abi.encodePacked(plan, provider));
        string memory output = string(abi.encodePacked("iac/", provider, "/", plan));
        int256 fileCount = int256(bytes(plan).length / 5) + 1;

        _plans[planId] = PlanRecord({
            plan: plan,
            provider: provider,
            output: output,
            fileCount: fileCount,
            emitted: true,
            applied: false,
            createdAt: block.timestamp
        });
        _planExists[planId] = true;

        emit EmitCompleted("ok", fileCount);

        return EmitOkResult({
            success: true,
            output: output,
            fileCount: fileCount
        });
    }

    /// @notice preview - Previews what changes would be applied without executing.
    function preview(string memory plan, string memory provider) external returns (PreviewOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");

        // Generate preview based on current resource state
        uint256 createCount = 0;
        uint256 updateCount = 0;
        uint256 deleteCount = 0;

        for (uint256 i = 0; i < _resourceIds.length; i++) {
            bytes32 id = _resourceIds[i];
            if (!_resourceExists[id]) continue;
            ResourceEntry storage r = _resources[id];
            if (keccak256(bytes(r.provider)) == keccak256(bytes(provider))) {
                if (keccak256(bytes(r.status)) == keccak256(bytes("planned"))) createCount++;
                else updateCount++;
            }
        }
        // Add one new resource to create
        createCount++;

        string[] memory toCreate = new string[](createCount);
        for (uint256 i = 0; i < createCount; i++) {
            toCreate[i] = string(abi.encodePacked(provider, "_resource_", _uint256ToString(i)));
        }

        string[] memory toUpdate = new string[](updateCount);
        string[] memory toDelete = new string[](deleteCount);

        uint256 estimatedCost = createCount * 50 + updateCount * 10;

        emit PreviewCompleted("ok", toCreate, toUpdate, toDelete, estimatedCost);

        return PreviewOkResult({
            success: true,
            toCreate: toCreate,
            toUpdate: toUpdate,
            toDelete: toDelete,
            estimatedMonthlyCost: estimatedCost
        });
    }

    /// @notice applyPlan - Executes an IaC plan, creating/updating/deleting resources.
    /// @dev Named applyPlan to avoid collision with Solidity keywords.
    function applyPlan(string memory plan, string memory provider) external returns (ApplyOkResult memory) {
        bytes32 planId = keccak256(abi.encodePacked(plan, provider));
        require(_planExists[planId], "Plan must be emitted before applying");
        require(_plans[planId].emitted, "Plan must be emitted before applying");

        // Create a resource entry for this plan
        bytes32 resourceId = keccak256(abi.encodePacked(plan, provider, block.timestamp));
        _resources[resourceId] = ResourceEntry({
            name: string(abi.encodePacked(provider, ":", plan)),
            provider: provider,
            resourceType: "managed",
            status: "created",
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });
        _resourceExists[resourceId] = true;
        _resourceIds.push(resourceId);

        _plans[planId].applied = true;

        string[] memory created = new string[](1);
        created[0] = string(abi.encodePacked(provider, ":", plan));
        string[] memory updated = new string[](0);
        string[] memory deleted = new string[](0);
        string[] memory failed = new string[](0);

        emit ApplyCompleted("ok", created, updated, deleted, failed);

        return ApplyOkResult({
            success: true,
            created: created,
            updated: updated,
            deleted: deleted
        });
    }

    /// @notice detectDrift - Detects configuration drift in managed resources.
    function detectDrift(string memory provider) external returns (DetectDriftOkResult memory) {
        uint256 cleanCount = 0;

        for (uint256 i = 0; i < _resourceIds.length; i++) {
            bytes32 id = _resourceIds[i];
            if (!_resourceExists[id]) continue;
            ResourceEntry storage r = _resources[id];
            if (keccak256(bytes(r.provider)) == keccak256(bytes(provider))) {
                cleanCount++;
            }
        }

        string[] memory drifted = new string[](0);
        string[] memory clean = new string[](cleanCount);
        uint256 idx = 0;

        for (uint256 i = 0; i < _resourceIds.length; i++) {
            bytes32 id = _resourceIds[i];
            if (!_resourceExists[id]) continue;
            ResourceEntry storage r = _resources[id];
            if (keccak256(bytes(r.provider)) == keccak256(bytes(provider))) {
                clean[idx] = r.name;
                idx++;
            }
        }

        emit DetectDriftCompleted("ok", drifted, clean);

        return DetectDriftOkResult({
            success: true,
            drifted: drifted,
            clean: clean
        });
    }

    /// @notice teardown - Destroys all resources managed by a plan.
    function teardown(string memory plan, string memory provider) external returns (TeardownOkResult memory) {
        uint256 destroyCount = 0;

        for (uint256 i = 0; i < _resourceIds.length; i++) {
            bytes32 id = _resourceIds[i];
            if (!_resourceExists[id]) continue;
            ResourceEntry storage r = _resources[id];
            if (keccak256(bytes(r.provider)) == keccak256(bytes(provider))) {
                destroyCount++;
            }
        }

        string[] memory destroyed = new string[](destroyCount);
        uint256 idx = 0;

        for (uint256 i = 0; i < _resourceIds.length; i++) {
            bytes32 id = _resourceIds[i];
            if (!_resourceExists[id]) continue;
            ResourceEntry storage r = _resources[id];
            if (keccak256(bytes(r.provider)) == keccak256(bytes(provider))) {
                destroyed[idx] = r.name;
                idx++;
                r.status = "deleted";
                r.exists = false;
                _resourceExists[id] = false;
            }
        }

        string[] memory emptyStuck = new string[](0);
        emit TeardownCompleted("ok", destroyed, emptyStuck);

        return TeardownOkResult({
            success: true,
            destroyed: destroyed
        });
    }

    // --- Internal helpers ---

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
