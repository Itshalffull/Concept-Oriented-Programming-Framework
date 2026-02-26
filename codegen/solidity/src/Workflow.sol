// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Workflow
/// @notice Concept-oriented workflow engine with states, transitions, and entity tracking
/// @dev Implements the Workflow concept from Clef specification.
///      Supports defining workflows with states and guarded transitions, and tracking
///      per-entity current state within a workflow.

contract Workflow {
    // --- Types ---

    struct State {
        string name;
        string config;
        bool exists;
    }

    struct Transition {
        bytes32 fromState;
        bytes32 toState;
        string guard;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps workflow ID -> state hash -> State definition
    mapping(bytes32 => mapping(bytes32 => State)) private _states;

    /// @dev Maps workflow ID -> array of transitions
    mapping(bytes32 => Transition[]) private _transitions;

    /// @dev Maps workflow ID -> entity ID -> current state hash
    mapping(bytes32 => mapping(bytes32 => bytes32)) private _currentStates;

    /// @dev Tracks whether a workflow has been created
    mapping(bytes32 => bool) private _workflowExists;

    // --- Events ---

    event WorkflowCreated(bytes32 indexed workflowId);
    event StateDefined(bytes32 indexed workflowId, string name);
    event TransitionDefined(bytes32 indexed workflowId, bytes32 fromState, bytes32 toState);
    event Transitioned(bytes32 indexed workflowId, bytes32 indexed entityId, bytes32 fromState, bytes32 toState);

    // --- Actions ---

    /// @notice Create a new workflow
    /// @param workflowId The unique identifier for the workflow
    function createWorkflow(bytes32 workflowId) external {
        require(workflowId != bytes32(0), "Workflow ID cannot be zero");
        require(!_workflowExists[workflowId], "Workflow already exists");

        _workflowExists[workflowId] = true;

        emit WorkflowCreated(workflowId);
    }

    /// @notice Define a state within a workflow
    /// @param workflowId The workflow to define the state in
    /// @param stateHash The hash identifier for the state
    /// @param name The human-readable state name
    /// @param config Configuration data for the state
    function defineState(
        bytes32 workflowId,
        bytes32 stateHash,
        string calldata name,
        string calldata config
    ) external {
        require(_workflowExists[workflowId], "Workflow not found");
        require(stateHash != bytes32(0), "State hash cannot be zero");
        require(bytes(name).length > 0, "State name cannot be empty");

        _states[workflowId][stateHash] = State({
            name: name,
            config: config,
            exists: true
        });

        emit StateDefined(workflowId, name);
    }

    /// @notice Define a transition between two states in a workflow
    /// @param workflowId The workflow to define the transition in
    /// @param fromState The source state hash
    /// @param toState The target state hash
    /// @param guard Guard condition for the transition
    function defineTransition(
        bytes32 workflowId,
        bytes32 fromState,
        bytes32 toState,
        string calldata guard
    ) external {
        require(_workflowExists[workflowId], "Workflow not found");
        require(_states[workflowId][fromState].exists, "From state not found");
        require(_states[workflowId][toState].exists, "To state not found");

        _transitions[workflowId].push(Transition({
            fromState: fromState,
            toState: toState,
            guard: guard,
            exists: true
        }));

        emit TransitionDefined(workflowId, fromState, toState);
    }

    /// @notice Transition an entity to a target state within a workflow
    /// @param workflowId The workflow ID
    /// @param entityId The entity being transitioned
    /// @param targetState The target state hash
    function transition(bytes32 workflowId, bytes32 entityId, bytes32 targetState) external {
        require(_workflowExists[workflowId], "Workflow not found");
        require(_states[workflowId][targetState].exists, "Target state not found");

        bytes32 fromState = _currentStates[workflowId][entityId];
        _currentStates[workflowId][entityId] = targetState;

        emit Transitioned(workflowId, entityId, fromState, targetState);
    }

    // --- Views ---

    /// @notice Get the current state of an entity within a workflow
    /// @param workflowId The workflow ID
    /// @param entityId The entity ID
    /// @return The current state hash (bytes32(0) if not yet transitioned)
    function getCurrentState(bytes32 workflowId, bytes32 entityId) external view returns (bytes32) {
        return _currentStates[workflowId][entityId];
    }

    /// @notice Get a state definition within a workflow
    /// @param workflowId The workflow ID
    /// @param stateHash The state hash
    /// @return The state data struct
    function getState(bytes32 workflowId, bytes32 stateHash) external view returns (State memory) {
        require(_states[workflowId][stateHash].exists, "State not found");
        return _states[workflowId][stateHash];
    }
}
