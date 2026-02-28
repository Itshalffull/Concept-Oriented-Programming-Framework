// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Machine
/// @notice State machine management for UI components with event-driven transitions.
contract Machine {

    // --- Storage ---

    struct MachineEntry {
        string widget;
        string context;
        string currentState;
        string props;
        bool active;
        uint256 createdAt;
    }

    mapping(bytes32 => MachineEntry) private _machines;
    mapping(bytes32 => bool) private _exists;

    // --- Types ---

    struct SpawnOkResult {
        bool success;
        bytes32 machine;
    }

    struct SendOkResult {
        bool success;
        bytes32 machine;
        string state;
    }

    struct ConnectOkResult {
        bool success;
        bytes32 machine;
        string props;
    }

    struct DestroyOkResult {
        bool success;
        bytes32 machine;
    }

    // --- Events ---

    event SpawnCompleted(string variant, bytes32 indexed machine);
    event SendCompleted(string variant, bytes32 indexed machine);
    event ConnectCompleted(string variant, bytes32 indexed machine);
    event DestroyCompleted(string variant, bytes32 indexed machine);

    // --- Actions ---

    /// @notice Spawn a new state machine for a widget.
    function spawn(bytes32 machine, string memory widget, string memory context) external returns (SpawnOkResult memory) {
        require(!_exists[machine], "Machine already exists");
        require(bytes(widget).length > 0, "Widget required");

        _machines[machine] = MachineEntry({
            widget: widget,
            context: context,
            currentState: "initial",
            props: "{}",
            active: true,
            createdAt: block.timestamp
        });
        _exists[machine] = true;

        emit SpawnCompleted("ok", machine);
        return SpawnOkResult({success: true, machine: machine});
    }

    /// @notice Send an event to the state machine, triggering a transition.
    function send(bytes32 machine, string memory machineEvent) external returns (SendOkResult memory) {
        require(_exists[machine], "Machine not found");
        require(_machines[machine].active, "Machine not active");

        // Transition the state based on the event
        string memory previousState = _machines[machine].currentState;
        _machines[machine].currentState = string(abi.encodePacked(previousState, "->", machineEvent));

        emit SendCompleted("ok", machine);
        return SendOkResult({success: true, machine: machine, state: _machines[machine].currentState});
    }

    /// @notice Connect to a machine to get its current derived props.
    function connect(bytes32 machine) external returns (ConnectOkResult memory) {
        require(_exists[machine], "Machine not found");

        emit ConnectCompleted("ok", machine);
        return ConnectOkResult({success: true, machine: machine, props: _machines[machine].props});
    }

    /// @notice Destroy a state machine, cleaning up resources.
    function destroy(bytes32 machine) external returns (DestroyOkResult memory) {
        require(_exists[machine], "Machine not found");

        _machines[machine].active = false;
        delete _machines[machine];
        _exists[machine] = false;

        emit DestroyCompleted("ok", machine);
        return DestroyOkResult({success: true, machine: machine});
    }

}
