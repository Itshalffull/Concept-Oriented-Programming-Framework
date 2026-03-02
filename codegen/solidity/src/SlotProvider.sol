// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SlotProvider
/// @notice Slot surface provider
/// @dev Implements the SlotProvider concept from Clef specification.
///      Provides slot definition, filling, and clearing for surface generation.

contract SlotProvider {

    // --- Types ---

    struct InitializeOkResult {
        bool success;
        bytes32 instance;
    }

    struct InitializeConfigErrorResult {
        bool success;
        string message;
    }

    struct DefineOkResult {
        bool success;
        bytes32 instance;
        string slotName;
    }

    struct DefineConflictErrorResult {
        bool success;
        string message;
    }

    struct FillOkResult {
        bool success;
        bytes32 instance;
        string slotName;
        bytes32 fillId;
    }

    struct FillNotFoundErrorResult {
        bool success;
        string message;
    }

    struct ClearOkResult {
        bool success;
        bytes32 instance;
        string slotName;
    }

    struct ClearNotFoundErrorResult {
        bool success;
        string message;
    }

    struct GetSlotsOkResult {
        bool success;
        bytes32 instance;
        uint256 count;
    }

    struct GetSlotsEmptyErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps instance ID to existence
    mapping(bytes32 => bool) private _instances;

    /// @dev Ordered list of instance IDs
    bytes32[] private _instanceKeys;

    /// @dev Maps instance ID to slot name to defined state
    mapping(bytes32 => mapping(string => bool)) private _slots;

    /// @dev Maps instance ID to slot name to fill ID
    mapping(bytes32 => mapping(string => bytes32)) private _fills;

    // --- Events ---

    event InitializeCompleted(string variant, bytes32 instance);
    event DefineCompleted(string variant, bytes32 instance);
    event FillCompleted(string variant, bytes32 instance);
    event ClearCompleted(string variant, bytes32 instance);
    event GetSlotsCompleted(string variant, bytes32 instance);

    // --- Metadata ---

    /// @notice Returns static provider metadata
    /// @return name The provider name
    /// @return category The provider category
    function register() external pure returns (string memory name, string memory category) {
        return ("slot", "surface-provider");
    }

    // --- Actions ---

    /// @notice initialize — create a new slot provider instance
    function initialize() external returns (InitializeOkResult memory) {
        bytes32 instance = keccak256(abi.encodePacked("slot", "surface-provider", block.timestamp, _instanceKeys.length));

        _instances[instance] = true;
        _instanceKeys.push(instance);

        emit InitializeCompleted("ok", instance);

        return InitializeOkResult({success: true, instance: instance});
    }

    /// @notice define — define a named slot
    function define(bytes32 instance, string calldata slotName) external returns (DefineOkResult memory) {
        require(_instances[instance], "Instance not found");

        _slots[instance][slotName] = true;

        emit DefineCompleted("ok", instance);

        return DefineOkResult({success: true, instance: instance, slotName: slotName});
    }

    /// @notice fill — fill a named slot with content
    function fill(bytes32 instance, string calldata slotName) external returns (FillOkResult memory) {
        require(_instances[instance], "Instance not found");
        require(_slots[instance][slotName], "Slot not defined");

        bytes32 fillId = keccak256(abi.encodePacked(instance, slotName, block.timestamp));
        _fills[instance][slotName] = fillId;

        emit FillCompleted("ok", instance);

        return FillOkResult({success: true, instance: instance, slotName: slotName, fillId: fillId});
    }

    /// @notice clear — clear a named slot
    function clear(bytes32 instance, string calldata slotName) external returns (ClearOkResult memory) {
        require(_instances[instance], "Instance not found");
        require(_slots[instance][slotName], "Slot not defined");

        _fills[instance][slotName] = bytes32(0);

        emit ClearCompleted("ok", instance);

        return ClearOkResult({success: true, instance: instance, slotName: slotName});
    }

    /// @notice getSlots — retrieve slot count for an instance
    function getSlots(bytes32 instance) external returns (GetSlotsOkResult memory) {
        require(_instances[instance], "Instance not found");

        emit GetSlotsCompleted("ok", instance);

        return GetSlotsOkResult({success: true, instance: instance, count: _instanceKeys.length});
    }

}
