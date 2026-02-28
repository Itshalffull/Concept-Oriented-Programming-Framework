// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FluxProvider
/// @notice Flux GitOps provider — emits kustomizations and tracks reconciliation status.
contract FluxProvider {

    // --- Storage ---

    /// @dev kustomization ID => encoded kustomization data
    mapping(bytes32 => bytes) private _kustomData;

    /// @dev tracks which kustomization IDs exist
    mapping(bytes32 => bool) private _kustomExists;

    /// @dev ordered list of kustomization IDs
    bytes32[] private _kustomKeys;

    /// @dev kustomization ID => helm release name
    mapping(bytes32 => string) private _helmRelease;

    // --- Types ---

    struct EmitInput {
        string plan;
        string repo;
        string path;
    }

    struct EmitOkResult {
        bool success;
        bytes32 kustomization;
        string[] files;
    }

    struct ReconciliationStatusOkResult {
        bool success;
        bytes32 kustomization;
        string readyStatus;
        string appliedRevision;
        uint256 reconciledAt;
    }

    struct ReconciliationStatusPendingResult {
        bool success;
        bytes32 kustomization;
        string[] waitingOn;
    }

    struct ReconciliationStatusFailedResult {
        bool success;
        bytes32 kustomization;
        string reason;
    }

    struct HelmReleaseInput {
        bytes32 kustomization;
        string chart;
        string values;
    }

    struct HelmReleaseOkResult {
        bool success;
        bytes32 kustomization;
        string releaseName;
    }

    struct HelmReleaseChartNotFoundResult {
        bool success;
        string chart;
        string sourceRef;
    }

    // --- Events ---

    event EmitCompleted(string variant, bytes32 kustomization, string[] files);
    event ReconciliationStatusCompleted(string variant, bytes32 kustomization, uint256 reconciledAt, string[] waitingOn);
    event HelmReleaseCompleted(string variant, bytes32 kustomization);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "flux";
        category = "gitops";
        capabilities = new string[](3);
        capabilities[0] = "emit";
        capabilities[1] = "reconciliationStatus";
        capabilities[2] = "helmRelease";
    }

    // --- Actions ---

    /// @notice Emit Flux kustomization manifests.
    function emitManifests(string memory plan, string memory repo, string memory path) external returns (EmitOkResult memory) {
        require(bytes(plan).length > 0, "Plan must not be empty");
        require(bytes(repo).length > 0, "Repo must not be empty");

        bytes32 kustomization = keccak256(abi.encodePacked(plan, repo, path));

        _kustomData[kustomization] = abi.encode(plan, repo, path, block.timestamp);
        if (!_kustomExists[kustomization]) {
            _kustomExists[kustomization] = true;
            _kustomKeys.push(kustomization);
        }

        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(path, "/kustomization.yaml"));
        files[1] = string(abi.encodePacked(path, "/gotk-components.yaml"));

        emit EmitCompleted("ok", kustomization, files);

        return EmitOkResult({success: true, kustomization: kustomization, files: files});
    }

    /// @notice Check reconciliation status of a Flux kustomization.
    function reconciliationStatus(bytes32 kustomization) external returns (ReconciliationStatusOkResult memory) {
        require(_kustomExists[kustomization], "Kustomization not found");

        string[] memory empty = new string[](0);

        emit ReconciliationStatusCompleted("ok", kustomization, block.timestamp, empty);

        return ReconciliationStatusOkResult({
            success: true,
            kustomization: kustomization,
            readyStatus: "True",
            appliedRevision: "main@sha1:latest",
            reconciledAt: block.timestamp
        });
    }

    /// @notice Create or update a Helm release within a Flux kustomization.
    function helmRelease(bytes32 kustomization, string memory chart, string memory values) external returns (HelmReleaseOkResult memory) {
        require(_kustomExists[kustomization], "Kustomization not found");
        require(bytes(chart).length > 0, "Chart must not be empty");

        string memory releaseName = string(abi.encodePacked(chart, "-release"));
        _helmRelease[kustomization] = releaseName;

        emit HelmReleaseCompleted("ok", kustomization);

        return HelmReleaseOkResult({success: true, kustomization: kustomization, releaseName: releaseName});
    }

}
