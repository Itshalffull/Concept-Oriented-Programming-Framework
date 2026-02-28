// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DockerComposeRuntime
/// @notice Docker Compose runtime — provisions services and manages container deployments.
contract DockerComposeRuntime {

    // --- Storage ---

    /// @dev service ID => encoded service data
    mapping(bytes32 => bytes) private _serviceData;

    /// @dev tracks which service IDs exist
    mapping(bytes32 => bool) private _serviceExists;

    /// @dev ordered list of service IDs
    bytes32[] private _serviceKeys;

    /// @dev service ID => current image string
    mapping(bytes32 => string) private _currentImage;

    /// @dev service ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev service ID => container counter
    mapping(bytes32 => uint256) private _containerCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string composePath;
        string[] ports;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 service;
        string serviceName;
        string endpoint;
    }

    struct ProvisionPortConflictResult {
        bool success;
        int256 port;
        string existingService;
    }

    struct DeployInput {
        bytes32 service;
        string imageUri;
    }

    struct DeployOkResult {
        bool success;
        bytes32 service;
        string containerId;
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
        string targetImage;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 service;
        string restoredImage;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 service;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 service, int256 port);
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
        name = "docker-compose";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision a Docker Compose service.
    function provision(string memory concept, string memory composePath, string[] memory ports) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(composePath).length > 0, "Compose path must not be empty");

        bytes32 service = keccak256(abi.encodePacked(concept, composePath));

        _serviceData[service] = abi.encode(concept, composePath, ports, block.timestamp);
        if (!_serviceExists[service]) {
            _serviceExists[service] = true;
            _serviceKeys.push(service);
            _containerCounter[service] = 0;
            _trafficWeight[service] = 100;
        }

        string memory serviceName = concept;
        string memory endpoint = string(abi.encodePacked("http://localhost:", ports.length > 0 ? ports[0] : "8080"));

        emit ProvisionCompleted("ok", service, int256(0));

        return ProvisionOkResult({success: true, service: service, serviceName: serviceName, endpoint: endpoint});
    }

    /// @notice Deploy a new image to a Docker Compose service.
    function deploy(bytes32 service, string memory imageUri) external returns (DeployOkResult memory) {
        require(_serviceExists[service], "Service not found - provision first");
        require(bytes(imageUri).length > 0, "Image URI must not be empty");

        _containerCounter[service] += 1;
        _currentImage[service] = imageUri;
        string memory containerId = string(abi.encodePacked("container-", _toString(_containerCounter[service])));

        emit DeployCompleted("ok", service);

        return DeployOkResult({success: true, service: service, containerId: containerId});
    }

    /// @notice Set the traffic weight for a Docker Compose service.
    function setTrafficWeight(bytes32 service, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_serviceExists[service], "Service not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[service] = weight;

        emit SetTrafficWeightCompleted("ok", service);

        return SetTrafficWeightOkResult({success: true, service: service});
    }

    /// @notice Rollback a Docker Compose service to a target image.
    function rollback(bytes32 service, string memory targetImage) external returns (RollbackOkResult memory) {
        require(_serviceExists[service], "Service not found");
        require(bytes(targetImage).length > 0, "Target image must not be empty");

        _currentImage[service] = targetImage;

        emit RollbackCompleted("ok", service);

        return RollbackOkResult({success: true, service: service, restoredImage: targetImage});
    }

    /// @notice Destroy a Docker Compose service.
    function destroy(bytes32 service) external returns (DestroyOkResult memory) {
        require(_serviceExists[service], "Service not found");

        _serviceExists[service] = false;
        delete _serviceData[service];
        delete _currentImage[service];
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
