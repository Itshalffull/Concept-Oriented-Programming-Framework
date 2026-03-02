// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MachineProvider
/// @notice Machine surface provider
/// @dev Implements the MachineProvider concept from Clef specification.
///      Provides state machine spawning, messaging, and lifecycle for surface generation.

contract MachineProvider {

    // --- Types ---

    struct InitializeOkResult {
        bool success;
        bytes32 instance;
    }

    struct InitializeConfigErrorResult {
        bool success;
        string message;
    }

    struct SpawnOkResult {
        bool success;
        bytes32 instance;
        bytes32 machineId;
    }

    struct SpawnLimitErrorResult {
        bool success;
        string message;
    }

    struct SendOkResult {
        bool success;
        bytes32 instance;
        bytes32 machineId;
        string eventName;
    }

    struct SendNotFoundErrorResult {
        bool success;
        string message;
    }

    struct ConnectOkResult {
        bool success;
        bytes32 instance;
        bytes32 sourceMachineId;
        bytes32 targetMachineId;
    }

    struct ConnectNotFoundErrorResult {
        bool success;
        string message;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 instance;
        bytes32 machineId;
    }

    struct DestroyNotFoundErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps instance ID to existence
    mapping(bytes32 => bool) private _instances;

    /// @dev Ordered list of instance IDs
    bytes32[] private _instanceKeys;

    /// @dev Maps instance ID to machine ID to active state
    mapping(bytes32 => mapping(bytes32 => bool)) private _machines;

    /// @dev Maps instance ID to machine ID to current state name
    mapping(bytes32 => mapping(bytes32 => string)) private _machineState;

    // --- Events ---

    event InitializeCompleted(string variant, bytes32 instance);
    event SpawnCompleted(string variant, bytes32 instance);
    event SendCompleted(string variant, bytes32 instance);
    event ConnectCompleted(string variant, bytes32 instance);
    event DestroyCompleted(string variant, bytes32 instance);

    // --- Metadata ---

    /// @notice Returns static provider metadata
    /// @return name The provider name
    /// @return category The provider category
    function register() external pure returns (string memory name, string memory category) {
        return ("machine", "surface-provider");
    }

    // --- Actions ---

    /// @notice initialize — create a new machine provider instance
    function initialize() external returns (InitializeOkResult memory) {
        bytes32 instance = keccak256(abi.encodePacked("machine", "surface-provider", block.timestamp, _instanceKeys.length));

        _instances[instance] = true;
        _instanceKeys.push(instance);

        emit InitializeCompleted("ok", instance);

        return InitializeOkResult({success: true, instance: instance});
    }

    /// @notice spawn — create a new state machine
    function spawn(bytes32 instance, string calldata initialState) external returns (SpawnOkResult memory) {
        require(_instances[instance], "Instance not found");

        bytes32 machineId = keccak256(abi.encodePacked(instance, initialState, block.timestamp));
        _machines[instance][machineId] = true;
        _machineState[instance][machineId] = initialState;

        emit SpawnCompleted("ok", instance);

        return SpawnOkResult({success: true, instance: instance, machineId: machineId});
    }

    /// @notice send — send an event to a state machine
    function send(bytes32 instance, bytes32 machineId, string calldata eventName) external returns (SendOkResult memory) {
        require(_instances[instance], "Instance not found");
        require(_machines[instance][machineId], "Machine not found");

        emit SendCompleted("ok", instance);

        return SendOkResult({success: true, instance: instance, machineId: machineId, eventName: eventName});
    }

    /// @notice connect — connect two state machines
    function connect(bytes32 instance, bytes32 sourceMachineId, bytes32 targetMachineId) external returns (ConnectOkResult memory) {
        require(_instances[instance], "Instance not found");
        require(_machines[instance][sourceMachineId], "Source machine not found");
        require(_machines[instance][targetMachineId], "Target machine not found");

        emit ConnectCompleted("ok", instance);

        return ConnectOkResult({success: true, instance: instance, sourceMachineId: sourceMachineId, targetMachineId: targetMachineId});
    }

    /// @notice destroy — destroy a state machine
    function destroy(bytes32 instance, bytes32 machineId) external returns (DestroyOkResult memory) {
        require(_instances[instance], "Instance not found");
        require(_machines[instance][machineId], "Machine not found");

        _machines[instance][machineId] = false;
        _machineState[instance][machineId] = "";

        emit DestroyCompleted("ok", instance);

        return DestroyOkResult({success: true, instance: instance, machineId: machineId});
    }

}
