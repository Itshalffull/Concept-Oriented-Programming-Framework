// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WidgetStateEntity
/// @notice Widget state entity extraction and query for UI state machine specifications.
/// @dev Manages widget state entities with widget-based lookups, reachability, and event tracing.

contract WidgetStateEntity {

    // --- Storage ---

    struct StateData {
        string widget;
        string name;
        string initial;
        uint256 transitionCount;
        bool exists;
    }

    mapping(bytes32 => StateData) private _states;
    bytes32[] private _stateIds;

    // Widget index: widgetHash => list of state IDs
    mapping(bytes32 => bytes32[]) private _widgetIndex;

    // Transition adjacency: stateId => list of reachable state IDs
    mapping(bytes32 => bytes32[]) private _transitions;

    // Event-to-state mapping: eventHash => list of state IDs that handle it
    mapping(bytes32 => bytes32[]) private _eventHandlers;

    // --- Types ---

    struct RegisterInput {
        string widget;
        string name;
        string initial;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 widgetState;
    }

    struct FindByWidgetOkResult {
        bool success;
        string states;
    }

    struct ReachableFromOkResult {
        bool success;
        string reachable;
        string via;
    }

    struct UnreachableStatesOkResult {
        bool success;
        string unreachable;
    }

    struct TraceEventInput {
        string widget;
        string eventName;
    }

    struct TraceEventOkResult {
        bool success;
        string paths;
    }

    struct TraceEventUnhandledResult {
        bool success;
        string inStates;
    }

    struct GetOkResult {
        bool success;
        bytes32 widgetState;
        string widget;
        string name;
        string initial;
        int256 transitionCount;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 widgetState);
    event FindByWidgetCompleted(string variant);
    event ReachableFromCompleted(string variant);
    event UnreachableStatesCompleted(string variant);
    event TraceEventCompleted(string variant);
    event GetCompleted(string variant, bytes32 widgetState, int256 transitionCount);

    // --- Actions ---

    /// @notice register
    function register(string memory widget, string memory name, string memory initial) external returns (RegisterOkResult memory) {
        require(bytes(widget).length > 0, "Widget must not be empty");
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 stateId = keccak256(abi.encodePacked(widget, name));
        require(!_states[stateId].exists, "Widget state already registered");

        _states[stateId] = StateData({
            widget: widget,
            name: name,
            initial: initial,
            transitionCount: 0,
            exists: true
        });
        _stateIds.push(stateId);

        bytes32 widgetHash = keccak256(abi.encodePacked(widget));
        _widgetIndex[widgetHash].push(stateId);

        emit RegisterCompleted("ok", stateId);
        return RegisterOkResult({success: true, widgetState: stateId});
    }

    /// @notice findByWidget
    function findByWidget(string memory widget) external returns (FindByWidgetOkResult memory) {
        bytes32 widgetHash = keccak256(abi.encodePacked(widget));
        bytes32[] storage ids = _widgetIndex[widgetHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _states[ids[i]].name));
        }

        emit FindByWidgetCompleted("ok");
        return FindByWidgetOkResult({success: true, states: result});
    }

    /// @notice reachableFrom
    function reachableFrom(bytes32 widgetState) external returns (ReachableFromOkResult memory) {
        require(_states[widgetState].exists, "Widget state not found");

        bytes32[] storage reachableIds = _transitions[widgetState];

        string memory reachable = "";
        string memory via = "";
        for (uint256 i = 0; i < reachableIds.length; i++) {
            if (i > 0) {
                reachable = string(abi.encodePacked(reachable, ","));
                via = string(abi.encodePacked(via, ","));
            }
            reachable = string(abi.encodePacked(reachable, _states[reachableIds[i]].name));
            via = string(abi.encodePacked(via, "transition"));
        }

        emit ReachableFromCompleted("ok");
        return ReachableFromOkResult({success: true, reachable: reachable, via: via});
    }

    /// @notice unreachableStates
    function unreachableStates(string memory widget) external returns (UnreachableStatesOkResult memory) {
        bytes32 widgetHash = keccak256(abi.encodePacked(widget));
        bytes32[] storage ids = _widgetIndex[widgetHash];

        // A state is unreachable if no other state transitions to it and it is not initial
        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            StateData storage s = _states[ids[i]];
            bool isReachable = false;

            // Check if this is the initial state
            bytes32 initialHash = keccak256(abi.encodePacked(s.initial));
            bytes32 nameHash = keccak256(abi.encodePacked(s.name));
            if (initialHash == nameHash) {
                isReachable = true;
            }

            // Check if any state transitions to this one
            if (!isReachable) {
                for (uint256 j = 0; j < ids.length; j++) {
                    bytes32[] storage trans = _transitions[ids[j]];
                    for (uint256 k = 0; k < trans.length; k++) {
                        if (trans[k] == ids[i]) {
                            isReachable = true;
                            break;
                        }
                    }
                    if (isReachable) break;
                }
            }

            if (!isReachable) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, s.name));
                count++;
            }
        }

        emit UnreachableStatesCompleted("ok");
        return UnreachableStatesOkResult({success: true, unreachable: result});
    }

    /// @notice traceEvent
    function traceEvent(string memory widget, string memory event_) external returns (TraceEventOkResult memory) {
        bytes32 eventHash = keccak256(abi.encodePacked(widget, event_));
        bytes32[] storage handlers = _eventHandlers[eventHash];

        string memory paths = "";
        for (uint256 i = 0; i < handlers.length; i++) {
            if (i > 0) {
                paths = string(abi.encodePacked(paths, ","));
            }
            paths = string(abi.encodePacked(paths, _states[handlers[i]].name));
        }

        emit TraceEventCompleted("ok");
        return TraceEventOkResult({success: true, paths: paths});
    }

    /// @notice get
    function get(bytes32 widgetState) external returns (GetOkResult memory) {
        require(_states[widgetState].exists, "Widget state not found");

        StateData storage data = _states[widgetState];

        emit GetCompleted("ok", widgetState, int256(data.transitionCount));
        return GetOkResult({
            success: true,
            widgetState: widgetState,
            widget: data.widget,
            name: data.name,
            initial: data.initial,
            transitionCount: int256(data.transitionCount)
        });
    }

}
