// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ArgoCDProvider
/// @notice ArgoCD GitOps provider — emits Kubernetes manifests and tracks reconciliation status.
contract ArgoCDProvider {

    // --- Storage ---

    /// @dev application ID => encoded application data (plan, repo, path, syncWave, timestamp)
    mapping(bytes32 => bytes) private _appData;

    /// @dev tracks which application IDs exist
    mapping(bytes32 => bool) private _appExists;

    /// @dev ordered list of application IDs
    bytes32[] private _appKeys;

    /// @dev application ID => sync wave value
    mapping(bytes32 => int256) private _syncWave;

    // --- Types ---

    struct EmitInput {
        string plan;
        string repo;
        string path;
    }

    struct EmitOkResult {
        bool success;
        bytes32 application;
        string[] files;
    }

    struct ReconciliationStatusOkResult {
        bool success;
        bytes32 application;
        string syncStatus;
        string healthStatus;
        uint256 reconciledAt;
    }

    struct ReconciliationStatusPendingResult {
        bool success;
        bytes32 application;
        string[] waitingOn;
    }

    struct ReconciliationStatusDegradedResult {
        bool success;
        bytes32 application;
        string[] unhealthyResources;
    }

    struct ReconciliationStatusFailedResult {
        bool success;
        bytes32 application;
        string reason;
    }

    struct SyncWaveInput {
        bytes32 application;
        int256 wave;
    }

    struct SyncWaveOkResult {
        bool success;
        bytes32 application;
    }

    // --- Events ---

    event EmitCompleted(string variant, bytes32 application, string[] files);
    event ReconciliationStatusCompleted(string variant, bytes32 application, uint256 reconciledAt, string[] waitingOn, string[] unhealthyResources);
    event SyncWaveCompleted(string variant, bytes32 application);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "argocd";
        category = "gitops";
        capabilities = new string[](3);
        capabilities[0] = "emit";
        capabilities[1] = "reconciliationStatus";
        capabilities[2] = "syncWave";
    }

    // --- Actions ---

    /// @notice Emit Kubernetes manifests for an ArgoCD application.
    function emitManifests(string memory plan, string memory repo, string memory path) external returns (EmitOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");
        require(bytes(repo).length > 0, "Repo must not be empty");

        bytes32 application = keccak256(abi.encodePacked(plan, repo, path));

        _appData[application] = abi.encode(plan, repo, path, block.timestamp);
        if (!_appExists[application]) {
            _appExists[application] = true;
            _appKeys.push(application);
        }

        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(path, "/application.yaml"));
        files[1] = string(abi.encodePacked(path, "/kustomization.yaml"));

        emit EmitCompleted("ok", application, files);

        return EmitOkResult({success: true, application: application, files: files});
    }

    /// @notice Check reconciliation status of an ArgoCD application.
    function reconciliationStatus(bytes32 application) external returns (ReconciliationStatusOkResult memory) {
        require(_appExists[application], "Application not found");

        string[] memory empty = new string[](0);

        emit ReconciliationStatusCompleted("ok", application, block.timestamp, empty, empty);

        return ReconciliationStatusOkResult({
            success: true,
            application: application,
            syncStatus: "Synced",
            healthStatus: "Healthy",
            reconciledAt: block.timestamp
        });
    }

    /// @notice Set the sync wave for an ArgoCD application.
    function syncWave(bytes32 application, int256 wave) external returns (SyncWaveOkResult memory) {
        require(_appExists[application], "Application not found");

        _syncWave[application] = wave;

        emit SyncWaveCompleted("ok", application);

        return SyncWaveOkResult({success: true, application: application});
    }

}
