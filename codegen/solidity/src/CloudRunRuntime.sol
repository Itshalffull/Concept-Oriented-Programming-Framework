// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CloudRunRuntime
/// @notice Google Cloud Run runtime — provisions services and manages deployments.
contract CloudRunRuntime {

    // --- Storage ---

    /// @dev service ID => encoded service data
    mapping(bytes32 => bytes) private _serviceData;

    /// @dev tracks which service IDs exist
    mapping(bytes32 => bool) private _serviceExists;

    /// @dev ordered list of service IDs
    bytes32[] private _serviceKeys;

    /// @dev service ID => current revision string
    mapping(bytes32 => string) private _currentRevision;

    /// @dev service ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev service ID => revision counter
    mapping(bytes32 => uint256) private _revisionCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string projectId;
        string region;
        int256 cpu;
        int256 memoryMb;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 service;
        string serviceUrl;
        string endpoint;
    }

    struct ProvisionBillingDisabledResult {
        bool success;
        string projectId;
    }

    struct ProvisionRegionUnavailableResult {
        bool success;
        string region;
    }

    struct DeployInput {
        bytes32 service;
        string imageUri;
    }

    struct DeployOkResult {
        bool success;
        bytes32 service;
        string revision;
    }

    struct DeployImageNotFoundResult {
        bool success;
        string imageUri;
    }

    struct SetTrafficWeightInput {
        bytes32 service;
        int256 weight;
    }

    struct SetTrafficWeightOkResult {
        bool success;
        bytes32 service;
    }

    struct RollbackInput {
        bytes32 service;
        string targetRevision;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 service;
        string restoredRevision;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 service;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 service);
    event DeployCompleted(string variant, bytes32 service);
    event SetTrafficWeightCompleted(string variant, bytes32 service);
    event RollbackCompleted(string variant, bytes32 service);
    event DestroyCompleted(string variant, bytes32 service);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "cloud-run";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision a Cloud Run service.
    function provision(string memory concept, string memory projectId, string memory region, int256 cpu, int256 memoryMb) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(projectId).length > 0, "Project ID must not be empty");

        bytes32 service = keccak256(abi.encodePacked(concept, projectId, region));

        _serviceData[service] = abi.encode(concept, projectId, region, cpu, memoryMb, block.timestamp);
        if (!_serviceExists[service]) {
            _serviceExists[service] = true;
            _serviceKeys.push(service);
            _revisionCounter[service] = 0;
            _trafficWeight[service] = 100;
        }

        string memory serviceUrl = string(abi.encodePacked("https://", concept, "-", region, ".run.app"));
        string memory endpoint = serviceUrl;

        emit ProvisionCompleted("ok", service);

        return ProvisionOkResult({success: true, service: service, serviceUrl: serviceUrl, endpoint: endpoint});
    }

    /// @notice Deploy a new revision to a Cloud Run service.
    function deploy(bytes32 service, string memory imageUri) external returns (DeployOkResult memory) {
        require(_serviceExists[service], "Service not found - provision first");
        require(bytes(imageUri).length > 0, "Image URI must not be empty");

        _revisionCounter[service] += 1;
        string memory revision = string(abi.encodePacked("rev-", _toString(_revisionCounter[service])));
        _currentRevision[service] = revision;
        _serviceData[service] = abi.encode(imageUri, revision, block.timestamp);

        emit DeployCompleted("ok", service);

        return DeployOkResult({success: true, service: service, revision: revision});
    }

    /// @notice Set the traffic weight for a Cloud Run service.
    function setTrafficWeight(bytes32 service, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_serviceExists[service], "Service not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[service] = weight;

        emit SetTrafficWeightCompleted("ok", service);

        return SetTrafficWeightOkResult({success: true, service: service});
    }

    /// @notice Rollback a Cloud Run service to a target revision.
    function rollback(bytes32 service, string memory targetRevision) external returns (RollbackOkResult memory) {
        require(_serviceExists[service], "Service not found");
        require(bytes(targetRevision).length > 0, "Target revision must not be empty");

        _currentRevision[service] = targetRevision;

        emit RollbackCompleted("ok", service);

        return RollbackOkResult({success: true, service: service, restoredRevision: targetRevision});
    }

    /// @notice Destroy a Cloud Run service.
    function destroy(bytes32 service) external returns (DestroyOkResult memory) {
        require(_serviceExists[service], "Service not found");

        _serviceExists[service] = false;
        delete _serviceData[service];
        delete _currentRevision[service];
        delete _trafficWeight[service];

        emit DestroyCompleted("ok", service);

        return DestroyOkResult({success: true, service: service});
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
