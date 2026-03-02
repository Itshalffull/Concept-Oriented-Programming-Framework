// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BindingProvider
/// @notice Binding surface provider
/// @dev Implements the BindingProvider concept from Clef specification.
///      Provides data binding, synchronization, and signal invocation for surface generation.

contract BindingProvider {

    // --- Types ---

    struct InitializeOkResult {
        bool success;
        bytes32 instance;
    }

    struct InitializeConfigErrorResult {
        bool success;
        string message;
    }

    struct BindOkResult {
        bool success;
        bytes32 instance;
        bytes32 connectionId;
    }

    struct BindConflictErrorResult {
        bool success;
        string message;
    }

    struct SyncOkResult {
        bool success;
        bytes32 instance;
        bytes32 connectionId;
    }

    struct SyncDisconnectedErrorResult {
        bool success;
        string message;
    }

    struct InvokeOkResult {
        bool success;
        bytes32 instance;
        string signal;
    }

    struct InvokeNotFoundErrorResult {
        bool success;
        string message;
    }

    struct UnbindOkResult {
        bool success;
        bytes32 instance;
        bytes32 connectionId;
    }

    struct UnbindNotFoundErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps instance ID to existence
    mapping(bytes32 => bool) private _instances;

    /// @dev Ordered list of instance IDs
    bytes32[] private _instanceKeys;

    /// @dev Maps instance ID to connection ID to active state
    mapping(bytes32 => mapping(bytes32 => bool)) private _connections;

    /// @dev Maps instance ID to signal name to connection ID
    mapping(bytes32 => mapping(string => bytes32)) private _signalMap;

    // --- Events ---

    event InitializeCompleted(string variant, bytes32 instance);
    event BindCompleted(string variant, bytes32 instance);
    event SyncCompleted(string variant, bytes32 instance);
    event InvokeCompleted(string variant, bytes32 instance);
    event UnbindCompleted(string variant, bytes32 instance);

    // --- Metadata ---

    /// @notice Returns static provider metadata
    /// @return name The provider name
    /// @return category The provider category
    function register() external pure returns (string memory name, string memory category) {
        return ("binding", "surface-provider");
    }

    // --- Actions ---

    /// @notice initialize — create a new binding provider instance
    function initialize() external returns (InitializeOkResult memory) {
        bytes32 instance = keccak256(abi.encodePacked("binding", "surface-provider", block.timestamp, _instanceKeys.length));

        _instances[instance] = true;
        _instanceKeys.push(instance);

        emit InitializeCompleted("ok", instance);

        return InitializeOkResult({success: true, instance: instance});
    }

    /// @notice bind — establish a data binding connection
    function bind(bytes32 instance, string calldata signal) external returns (BindOkResult memory) {
        require(_instances[instance], "Instance not found");

        bytes32 connectionId = keccak256(abi.encodePacked(instance, signal, block.timestamp));
        _connections[instance][connectionId] = true;
        _signalMap[instance][signal] = connectionId;

        emit BindCompleted("ok", instance);

        return BindOkResult({success: true, instance: instance, connectionId: connectionId});
    }

    /// @notice sync — synchronize a binding connection
    function sync(bytes32 instance, bytes32 connectionId) external returns (SyncOkResult memory) {
        require(_instances[instance], "Instance not found");
        require(_connections[instance][connectionId], "Connection not found");

        emit SyncCompleted("ok", instance);

        return SyncOkResult({success: true, instance: instance, connectionId: connectionId});
    }

    /// @notice invoke — invoke a signal by name
    function invoke(bytes32 instance, string calldata signal) external returns (InvokeOkResult memory) {
        require(_instances[instance], "Instance not found");

        emit InvokeCompleted("ok", instance);

        return InvokeOkResult({success: true, instance: instance, signal: signal});
    }

    /// @notice unbind — remove a data binding connection
    function unbind(bytes32 instance, bytes32 connectionId) external returns (UnbindOkResult memory) {
        require(_instances[instance], "Instance not found");
        require(_connections[instance][connectionId], "Connection not found");

        _connections[instance][connectionId] = false;

        emit UnbindCompleted("ok", instance);

        return UnbindOkResult({success: true, instance: instance, connectionId: connectionId});
    }

}
