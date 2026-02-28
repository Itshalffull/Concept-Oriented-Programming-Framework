// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EcsRuntime
/// @notice AWS ECS runtime — provisions ECS services and manages task deployments.
contract EcsRuntime {

    // --- Storage ---

    /// @dev service ID => encoded service data
    mapping(bytes32 => bytes) private _serviceData;

    /// @dev tracks which service IDs exist
    mapping(bytes32 => bool) private _serviceExists;

    /// @dev ordered list of service IDs
    bytes32[] private _serviceKeys;

    /// @dev service ID => current task definition string
    mapping(bytes32 => string) private _currentTaskDef;

    /// @dev service ID => traffic weight
    mapping(bytes32 => int256) private _trafficWeight;

    /// @dev service ID => task definition counter
    mapping(bytes32 => uint256) private _taskDefCounter;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        int256 cpu;
        int256 memoryMb;
        string cluster;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 service;
        string serviceArn;
        string endpoint;
    }

    struct ProvisionCapacityUnavailableResult {
        bool success;
        string cluster;
        string requested;
    }

    struct ProvisionClusterNotFoundResult {
        bool success;
        string cluster;
    }

    struct DeployInput {
        bytes32 service;
        string imageUri;
    }

    struct DeployOkResult {
        bool success;
        bytes32 service;
        string taskDefinition;
    }

    struct DeployImageNotFoundResult {
        bool success;
        string imageUri;
    }

    struct DeployHealthCheckFailedResult {
        bool success;
        bytes32 service;
        int256 failedTasks;
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
        string targetTaskDefinition;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 service;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 service;
    }

    struct DestroyDrainTimeoutResult {
        bool success;
        bytes32 service;
        int256 activeConnections;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 service);
    event DeployCompleted(string variant, bytes32 service, int256 failedTasks);
    event SetTrafficWeightCompleted(string variant, bytes32 service);
    event RollbackCompleted(string variant, bytes32 service);
    event DestroyCompleted(string variant, bytes32 service, int256 activeConnections);

    // --- Metadata ---

    /// @notice Returns static provider metadata.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory capabilities)
    {
        name = "ecs";
        category = "runtime";
        capabilities = new string[](5);
        capabilities[0] = "provision";
        capabilities[1] = "deploy";
        capabilities[2] = "setTrafficWeight";
        capabilities[3] = "rollback";
        capabilities[4] = "destroy";
    }

    // --- Actions ---

    /// @notice Provision an ECS service.
    function provision(string memory concept, int256 cpu, int256 memoryMb, string memory cluster) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(cluster).length > 0, "Cluster must not be empty");

        bytes32 service = keccak256(abi.encodePacked(concept, cluster));

        _serviceData[service] = abi.encode(concept, cpu, memoryMb, cluster, block.timestamp);
        if (!_serviceExists[service]) {
            _serviceExists[service] = true;
            _serviceKeys.push(service);
            _taskDefCounter[service] = 0;
            _trafficWeight[service] = 100;
        }

        string memory serviceArn = string(abi.encodePacked("arn:aws:ecs:us-east-1:000000000000:service/", cluster, "/", concept));
        string memory endpoint = string(abi.encodePacked("https://", concept, ".ecs.internal"));

        emit ProvisionCompleted("ok", service);

        return ProvisionOkResult({success: true, service: service, serviceArn: serviceArn, endpoint: endpoint});
    }

    /// @notice Deploy a new task definition to an ECS service.
    function deploy(bytes32 service, string memory imageUri) external returns (DeployOkResult memory) {
        require(_serviceExists[service], "Service not found - provision first");
        require(bytes(imageUri).length > 0, "Image URI must not be empty");

        _taskDefCounter[service] += 1;
        string memory taskDef = string(abi.encodePacked("task-def:", _toString(_taskDefCounter[service])));
        _currentTaskDef[service] = taskDef;
        _serviceData[service] = abi.encode(imageUri, taskDef, block.timestamp);

        emit DeployCompleted("ok", service, int256(0));

        return DeployOkResult({success: true, service: service, taskDefinition: taskDef});
    }

    /// @notice Set the traffic weight for an ECS service.
    function setTrafficWeight(bytes32 service, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_serviceExists[service], "Service not found");
        require(weight >= 0 && weight <= 100, "Weight must be 0-100");

        _trafficWeight[service] = weight;

        emit SetTrafficWeightCompleted("ok", service);

        return SetTrafficWeightOkResult({success: true, service: service});
    }

    /// @notice Rollback an ECS service to a target task definition.
    function rollback(bytes32 service, string memory targetTaskDefinition) external returns (RollbackOkResult memory) {
        require(_serviceExists[service], "Service not found");
        require(bytes(targetTaskDefinition).length > 0, "Target task definition must not be empty");

        _currentTaskDef[service] = targetTaskDefinition;

        emit RollbackCompleted("ok", service);

        return RollbackOkResult({success: true, service: service});
    }

    /// @notice Destroy an ECS service.
    function destroy(bytes32 service) external returns (DestroyOkResult memory) {
        require(_serviceExists[service], "Service not found");

        _serviceExists[service] = false;
        delete _serviceData[service];
        delete _currentTaskDef[service];
        delete _trafficWeight[service];

        emit DestroyCompleted("ok", service, int256(0));

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
