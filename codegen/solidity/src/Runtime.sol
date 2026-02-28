// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Runtime
/// @notice Runtime environment management with provisioning, deployment, traffic control, and health checks.
/// @dev Manages runtime instances through provision/deploy/scale/destroy lifecycle.

contract Runtime {

    // --- Storage ---

    struct InstanceEntry {
        string concept;
        string runtimeType;
        string config;
        string endpoint;
        string currentVersion;
        string previousVersion;
        int256 trafficWeight;
        string status; // "provisioned", "deployed", "healthy", "degraded", "destroyed"
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    mapping(bytes32 => InstanceEntry) private _instances;
    bytes32[] private _instanceIds;
    mapping(bytes32 => bool) private _instanceExists;

    // --- Types ---

    struct ProvisionInput {
        string concept;
        string runtimeType;
        string config;
    }

    struct ProvisionOkResult {
        bool success;
        bytes32 instance;
        string endpoint;
    }

    struct ProvisionAlreadyProvisionedResult {
        bool success;
        bytes32 instance;
        string endpoint;
    }

    struct ProvisionProvisionFailedResult {
        bool success;
        string concept;
        string runtimeType;
        string reason;
    }

    struct DeployInput {
        bytes32 instance;
        string artifact;
        string version;
    }

    struct DeployOkResult {
        bool success;
        bytes32 instance;
        string endpoint;
    }

    struct DeployDeployFailedResult {
        bool success;
        bytes32 instance;
        string reason;
    }

    struct SetTrafficWeightInput {
        bytes32 instance;
        int256 weight;
    }

    struct SetTrafficWeightOkResult {
        bool success;
        bytes32 instance;
        int256 newWeight;
    }

    struct RollbackOkResult {
        bool success;
        bytes32 instance;
        string previousVersion;
    }

    struct RollbackNoHistoryResult {
        bool success;
        bytes32 instance;
    }

    struct RollbackRollbackFailedResult {
        bool success;
        bytes32 instance;
        string reason;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 instance;
    }

    struct DestroyDestroyFailedResult {
        bool success;
        bytes32 instance;
        string reason;
    }

    struct HealthCheckOkResult {
        bool success;
        bytes32 instance;
        int256 latencyMs;
    }

    struct HealthCheckUnreachableResult {
        bool success;
        bytes32 instance;
    }

    struct HealthCheckDegradedResult {
        bool success;
        bytes32 instance;
        int256 latencyMs;
    }

    // --- Events ---

    event ProvisionCompleted(string variant, bytes32 instance);
    event DeployCompleted(string variant, bytes32 instance);
    event SetTrafficWeightCompleted(string variant, bytes32 instance, int256 newWeight);
    event RollbackCompleted(string variant, bytes32 instance);
    event DestroyCompleted(string variant, bytes32 instance);
    event HealthCheckCompleted(string variant, bytes32 instance, int256 latencyMs);

    // --- Actions ---

    /// @notice provision - Provisions a new runtime instance for a concept.
    function provision(string memory concept, string memory runtimeType, string memory config) external returns (ProvisionOkResult memory) {
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(runtimeType).length > 0, "Runtime type must not be empty");

        // Check for existing provision of same concept+type
        bytes32 dedupKey = keccak256(abi.encodePacked(concept, runtimeType));
        if (_instanceExists[dedupKey]) {
            InstanceEntry storage existing = _instances[dedupKey];
            emit ProvisionCompleted("alreadyProvisioned", dedupKey);
            return ProvisionOkResult({
                success: true,
                instance: dedupKey,
                endpoint: existing.endpoint
            });
        }

        bytes32 instanceId = dedupKey;
        string memory endpoint = string(abi.encodePacked(runtimeType, "://", concept, ".runtime.local"));

        _instances[instanceId] = InstanceEntry({
            concept: concept,
            runtimeType: runtimeType,
            config: config,
            endpoint: endpoint,
            currentVersion: "",
            previousVersion: "",
            trafficWeight: 0,
            status: "provisioned",
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });
        _instanceExists[instanceId] = true;
        _instanceIds.push(instanceId);

        emit ProvisionCompleted("ok", instanceId);

        return ProvisionOkResult({
            success: true,
            instance: instanceId,
            endpoint: endpoint
        });
    }

    /// @notice deploy - Deploys an artifact to a provisioned runtime instance.
    function deploy(bytes32 instance, string memory artifact, string memory version) external returns (DeployOkResult memory) {
        require(_instanceExists[instance], "Instance not found");
        InstanceEntry storage inst = _instances[instance];

        // Store version history for rollback
        inst.previousVersion = inst.currentVersion;
        inst.currentVersion = version;
        inst.status = "deployed";
        inst.trafficWeight = 100;
        inst.updatedAt = block.timestamp;

        emit DeployCompleted("ok", instance);

        return DeployOkResult({
            success: true,
            instance: instance,
            endpoint: inst.endpoint
        });
    }

    /// @notice setTrafficWeight - Adjusts the traffic weight for a runtime instance.
    function setTrafficWeight(bytes32 instance, int256 weight) external returns (SetTrafficWeightOkResult memory) {
        require(_instanceExists[instance], "Instance not found");
        require(weight >= 0 && weight <= 100, "Weight must be between 0 and 100");

        InstanceEntry storage inst = _instances[instance];
        inst.trafficWeight = weight;
        inst.updatedAt = block.timestamp;

        emit SetTrafficWeightCompleted("ok", instance, weight);

        return SetTrafficWeightOkResult({
            success: true,
            instance: instance,
            newWeight: weight
        });
    }

    /// @notice rollback - Rolls back to the previous deployed version.
    function rollback(bytes32 instance) external returns (RollbackOkResult memory) {
        require(_instanceExists[instance], "Instance not found");
        InstanceEntry storage inst = _instances[instance];
        require(bytes(inst.previousVersion).length > 0, "No previous version to rollback to");

        string memory prev = inst.previousVersion;
        inst.previousVersion = inst.currentVersion;
        inst.currentVersion = prev;
        inst.updatedAt = block.timestamp;

        emit RollbackCompleted("ok", instance);

        return RollbackOkResult({
            success: true,
            instance: instance,
            previousVersion: prev
        });
    }

    /// @notice destroy - Destroys a runtime instance and releases resources.
    function destroy(bytes32 instance) external returns (DestroyOkResult memory) {
        require(_instanceExists[instance], "Instance not found");
        InstanceEntry storage inst = _instances[instance];

        inst.status = "destroyed";
        inst.trafficWeight = 0;
        inst.exists = false;
        _instanceExists[instance] = false;
        inst.updatedAt = block.timestamp;

        emit DestroyCompleted("ok", instance);

        return DestroyOkResult({
            success: true,
            instance: instance
        });
    }

    /// @notice healthCheck - Runs a health check on a runtime instance.
    function healthCheck(bytes32 instance) external returns (HealthCheckOkResult memory) {
        require(_instanceExists[instance], "Instance not found");
        InstanceEntry storage inst = _instances[instance];

        // Simulate latency
        int256 latencyMs = int256(uint256(keccak256(abi.encodePacked(instance, block.timestamp))) % 50) + 1;

        inst.status = "healthy";
        inst.updatedAt = block.timestamp;

        emit HealthCheckCompleted("ok", instance, latencyMs);

        return HealthCheckOkResult({
            success: true,
            instance: instance,
            latencyMs: latencyMs
        });
    }
}
