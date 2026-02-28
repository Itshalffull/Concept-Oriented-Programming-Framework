// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GitOps
/// @notice GitOps workflow management with manifest emission and reconciliation status tracking.
/// @dev Manages desired-state manifests and tracks reconciliation against actual state.

contract GitOps {

    // --- Storage ---

    struct ManifestEntry {
        string plan;
        string controller;
        string repo;
        string path;
        string[] files;
        string reconciliationStatus; // "synced", "pending", "failed"
        uint256 reconciledAt;
        bool exists;
    }

    mapping(bytes32 => ManifestEntry) private _manifests;
    bytes32[] private _manifestIds;
    mapping(bytes32 => bool) private _manifestExists;

    // --- Types ---

    struct EmitInput {
        string plan;
        string controller;
        string repo;
        string path;
    }

    struct EmitOkResult {
        bool success;
        bytes32 manifest;
        string[] files;
    }

    struct EmitControllerUnsupportedResult {
        bool success;
        string controller;
    }

    struct ReconciliationStatusOkResult {
        bool success;
        bytes32 manifest;
        string status;
        uint256 reconciledAt;
    }

    struct ReconciliationStatusPendingResult {
        bool success;
        bytes32 manifest;
        string[] waitingOn;
    }

    struct ReconciliationStatusFailedResult {
        bool success;
        bytes32 manifest;
        string reason;
    }

    // --- Events ---

    event EmitCompleted(string variant, bytes32 manifest, string[] files);
    event ReconciliationStatusCompleted(string variant, bytes32 manifest, uint256 reconciledAt, string[] waitingOn);

    // --- Actions ---

    /// @notice emitManifest - Emits GitOps manifests for a deployment plan.
    /// @dev Named emitManifest to avoid collision with Solidity's emit keyword.
    function emitManifest(string memory plan, string memory controller, string memory repo, string memory path) external returns (EmitOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");
        require(bytes(controller).length > 0, "Controller must not be empty");

        bytes32 manifestId = keccak256(abi.encodePacked(plan, controller, repo, path, block.timestamp));

        // Generate file list based on the plan
        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(path, "/deployment.yaml"));
        files[1] = string(abi.encodePacked(path, "/service.yaml"));

        _manifests[manifestId] = ManifestEntry({
            plan: plan,
            controller: controller,
            repo: repo,
            path: path,
            files: files,
            reconciliationStatus: "pending",
            reconciledAt: 0,
            exists: true
        });
        _manifestExists[manifestId] = true;
        _manifestIds.push(manifestId);

        emit EmitCompleted("ok", manifestId, files);

        return EmitOkResult({
            success: true,
            manifest: manifestId,
            files: files
        });
    }

    /// @notice reconciliationStatus - Returns the reconciliation status of a manifest.
    function reconciliationStatus(bytes32 manifest) external returns (ReconciliationStatusOkResult memory) {
        require(_manifestExists[manifest], "Manifest not found");
        ManifestEntry storage entry = _manifests[manifest];

        // If not yet reconciled, mark as synced on first status check (simulated reconciliation)
        if (keccak256(bytes(entry.reconciliationStatus)) == keccak256(bytes("pending")) && entry.reconciledAt == 0) {
            entry.reconciliationStatus = "synced";
            entry.reconciledAt = block.timestamp;
        }

        string[] memory emptyWaiting = new string[](0);
        emit ReconciliationStatusCompleted("ok", manifest, entry.reconciledAt, emptyWaiting);

        return ReconciliationStatusOkResult({
            success: true,
            manifest: manifest,
            status: entry.reconciliationStatus,
            reconciledAt: entry.reconciledAt
        });
    }
}
