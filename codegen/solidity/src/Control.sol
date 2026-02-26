// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Control
/// @notice Concept-oriented UI control registry with type, label, value, binding, and action metadata
/// @dev Implements the Control concept from COPF specification.
///      Supports creating controls with associated bindings and actions, and updating values.

contract Control {
    // --- Types ---

    struct ControlData {
        string controlType;
        string label;
        string value;
        string binding;
        string action;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps control ID to its full data
    mapping(bytes32 => ControlData) private _controls;

    // --- Events ---

    event ControlCreated(bytes32 indexed controlId);
    event Interacted(bytes32 indexed controlId);
    event ValueSet(bytes32 indexed controlId, string value);

    // --- Actions ---

    /// @notice Create a new UI control
    /// @param controlId The unique identifier for the control
    /// @param controlType The type of control (e.g., "button", "input", "select")
    /// @param label The display label
    /// @param value The initial value
    /// @param binding The data binding expression
    /// @param action The action to trigger on interaction
    function create(
        bytes32 controlId,
        string calldata controlType,
        string calldata label,
        string calldata value,
        string calldata binding,
        string calldata action
    ) external {
        require(controlId != bytes32(0), "Control ID cannot be zero");
        require(!_controls[controlId].exists, "Control already exists");
        require(bytes(controlType).length > 0, "Control type cannot be empty");

        _controls[controlId] = ControlData({
            controlType: controlType,
            label: label,
            value: value,
            binding: binding,
            action: action,
            exists: true
        });

        emit ControlCreated(controlId);
    }

    /// @notice Set a new value for a control
    /// @param controlId The control ID to update
    /// @param value The new value
    function setValue(bytes32 controlId, string calldata value) external {
        require(_controls[controlId].exists, "Control not found");

        _controls[controlId].value = value;

        emit ValueSet(controlId, value);
        emit Interacted(controlId);
    }

    // --- Views ---

    /// @notice Get the current value of a control
    /// @param controlId The control ID
    /// @return The current value string
    function getValue(bytes32 controlId) external view returns (string memory) {
        require(_controls[controlId].exists, "Control not found");
        return _controls[controlId].value;
    }

    /// @notice Retrieve a control's full data
    /// @param controlId The control ID
    /// @return The full control data struct
    function getControl(bytes32 controlId) external view returns (ControlData memory) {
        require(_controls[controlId].exists, "Control not found");
        return _controls[controlId];
    }

    /// @notice Check if a control exists
    /// @param controlId The control ID
    /// @return Whether the control exists
    function controlExists(bytes32 controlId) external view returns (bool) {
        return _controls[controlId].exists;
    }
}
