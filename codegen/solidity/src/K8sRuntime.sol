// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title K8sRuntime
/// @notice Kubernetes runtime — provisions deployments and manages rollouts.
contract K8sRuntime {

    // --- Storage ---

    /// @dev deployment ID => encoded deployment data
    mapping(bytes32 => bytes) private _deployData;

    /// @dev tracks which deployment IDs exist
    mapping(bytes32 => bool) private _deployExists;

    /// @dev ordered list of deployment IDs
    bytes32[] private _deployKeys;

    /// @dev deployment ID => current revision string
    mapping(bytes32 => string) private _currentRevision;

    /// @dev deployment ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev deployment ID => revision counter
    mapping(bytes32 => uint256) private _revisionCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string namespace;
        string cluster;
        int256 replicas;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 deployment;
        string serviceName;
        string endpoint;
    }

    struct ProvisionResourceQuotaExceededResult {
        bool success;
        string namespace;
        string resource;
        string requested;
        string limit;
    }

    struct ProvisionNamespaceNotFoundResult {
        bool success;
        string namespace;
    }

    struct DeployInput {
        bytes32 deployment;
        string imageUri;
    }

    struct DeployOkResult {
        bool success;
        bytes32 deployment;
        string revision;
    }

    struct DeployPodCrashLoopResult {
        bool success;
        bytes32 deployment;
        string podName;
        int256 restartCount;
    }

    struct DeployImageNotFoundResult {
        bool success;
        string imageUri;
    }

    struct DeployImagePullBackOffResult {
        bool success;
        bytes32 deployment;
        string imageUri;
        string reason;
    }

    struct DeployOomKilledResult {
        bool success;
        bytes32 deployment;
        string podName;
        string memoryLimit;
    }

    struct SetTrafficWeightInput {
        bytes32 deployment;
        int256 weight;
    }

    struct SetTrafficWeightOkResult {
        bool success;
        bytes32 deployment;
    }

    struct RollbackInput {
        bytes32 deployment;
        string targetRevision;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 deployment;
        string restoredRevision;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 deployment;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 deployment);
    event DeployCompleted(string variant, bytes32 deployment, int256 restartCount);
    event SetTrafficWeightCompleted(string variant, bytes32 deployment);
    event RollbackCompleted(string variant, bytes32 deployment);
    event DestroyCompleted(string variant, bytes32 deployment);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "k8s";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision a Kubernetes deployment.
    function provision(string memory concept, string memory namespace, string memory cluster, int256 replicas) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(namespace).length > 0, "Namespace must not be empty");
        require(replicas > 0, "Replicas must be positive");

        bytes32 deployment = keccak256(abi.encodePacked(concept, namespace, cluster));

        _deployData[deployment] = abi.encode(concept, namespace, cluster, replicas, block.timestamp);
        if (!_deployExists[deployment]) {
            _deployExists[deployment] = true;
            _deployKeys.push(deployment);
            _revisionCounter[deployment] = 0;
            _trafficWeight[deployment] = 100;
        }

        string memory serviceName = string(abi.encodePacked(concept, "-svc"));
        string memory endpoint = string(abi.encodePacked(concept, "-svc.", namespace, ".svc.cluster.local"));

        emit ProvisionCompleted("ok", deployment);

        return ProvisionOkResult({success: true, deployment: deployment, serviceName: serviceName, endpoint: endpoint});
    }

    /// @notice Deploy a new image to a Kubernetes deployment.
    function deploy(bytes32 deployment, string memory imageUri) external returns (DeployOkResult memory) {
        require(_deployExists[deployment], "Deployment not found - provision first");
        require(bytes(imageUri).length > 0, "Image URI must not be empty");

        _revisionCounter[deployment] += 1;
        string memory revision = string(abi.encodePacked("rev-", _toString(_revisionCounter[deployment])));
        _currentRevision[deployment] = revision;
        _deployData[deployment] = abi.encode(imageUri, revision, block.timestamp);

        emit DeployCompleted("ok", deployment, int256(0));

        return DeployOkResult({success: true, deployment: deployment, revision: revision});
    }

    /// @notice Set the traffic weight for a Kubernetes deployment.
    function setTrafficWeight(bytes32 deployment, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_deployExists[deployment], "Deployment not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[deployment] = weight;

        emit SetTrafficWeightCompleted("ok", deployment);

        return SetTrafficWeightOkResult({success: true, deployment: deployment});
    }

    /// @notice Rollback a Kubernetes deployment to a target revision.
    function rollback(bytes32 deployment, string memory targetRevision) external returns (RollbackOkResult memory) {
        require(_deployExists[deployment], "Deployment not found");
        require(bytes(targetRevision).length > 0, "Target revision must not be empty");

        _currentRevision[deployment] = targetRevision;

        emit RollbackCompleted("ok", deployment);

        return RollbackOkResult({success: true, deployment: deployment, restoredRevision: targetRevision});
    }

    /// @notice Destroy a Kubernetes deployment.
    function destroy(bytes32 deployment) external returns (DestroyOkResult memory) {
        require(_deployExists[deployment], "Deployment not found");

        _deployExists[deployment] = false;
        delete _deployData[deployment];
        delete _currentRevision[deployment];
        delete _trafficWeight[deployment];

        emit DestroyCompleted("ok", deployment);

        return DestroyOkResult({success: true, deployment: deployment});
    }

    // --- Internal helpers ---

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

}
