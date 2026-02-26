// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EventBus
/// @notice Concept-oriented event bus with typed events, prioritized listeners, and dispatch
/// @dev Implements the EventBus concept from Clef specification.
///      Supports registering event types, subscribing/unsubscribing listeners with priority,
///      and dispatching events.

contract EventBus {
    // --- Types ---

    struct EventType {
        string payloadSchema;
        bool exists;
    }

    struct Listener {
        bytes32 listenerId;
        int256 priority;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps event type ID to its definition
    mapping(bytes32 => EventType) private _eventTypes;

    /// @dev Maps event type ID to array of listeners
    mapping(bytes32 => Listener[]) private _listeners;

    /// @dev Maps event type ID -> listener ID -> whether subscribed
    mapping(bytes32 => mapping(bytes32 => bool)) private _listenerExists;

    /// @dev Total number of dispatches
    uint256 private _dispatchCount;

    // --- Events ---

    event EventTypeRegistered(bytes32 indexed eventTypeId);
    event Subscribed(bytes32 indexed eventTypeId, bytes32 indexed listenerId);
    event Unsubscribed(bytes32 indexed eventTypeId, bytes32 indexed listenerId);
    event Dispatched(bytes32 indexed eventTypeId, uint256 listenerCount);

    // --- Actions ---

    /// @notice Register a new event type with its payload schema
    /// @param eventTypeId The unique identifier for the event type
    /// @param payloadSchema The schema definition for event payloads
    function registerEventType(bytes32 eventTypeId, string calldata payloadSchema) external {
        require(eventTypeId != bytes32(0), "Event type ID cannot be zero");
        require(!_eventTypes[eventTypeId].exists, "Event type already exists");

        _eventTypes[eventTypeId] = EventType({
            payloadSchema: payloadSchema,
            exists: true
        });

        emit EventTypeRegistered(eventTypeId);
    }

    /// @notice Subscribe a listener to an event type
    /// @param eventTypeId The event type to subscribe to
    /// @param listenerId The unique identifier for the listener
    /// @param priority The listener priority (higher = called first)
    function subscribe(bytes32 eventTypeId, bytes32 listenerId, int256 priority) external {
        require(_eventTypes[eventTypeId].exists, "Event type not found");
        require(listenerId != bytes32(0), "Listener ID cannot be zero");
        require(!_listenerExists[eventTypeId][listenerId], "Listener already subscribed");

        _listeners[eventTypeId].push(Listener({
            listenerId: listenerId,
            priority: priority,
            exists: true
        }));

        _listenerExists[eventTypeId][listenerId] = true;

        emit Subscribed(eventTypeId, listenerId);
    }

    /// @notice Unsubscribe a listener from an event type
    /// @param eventTypeId The event type to unsubscribe from
    /// @param listenerId The listener ID to remove
    function unsubscribe(bytes32 eventTypeId, bytes32 listenerId) external {
        require(_eventTypes[eventTypeId].exists, "Event type not found");
        require(_listenerExists[eventTypeId][listenerId], "Listener not subscribed");

        Listener[] storage listeners = _listeners[eventTypeId];
        for (uint256 i = 0; i < listeners.length; i++) {
            if (listeners[i].listenerId == listenerId) {
                // Swap with last element and pop
                listeners[i] = listeners[listeners.length - 1];
                listeners.pop();
                break;
            }
        }

        _listenerExists[eventTypeId][listenerId] = false;

        emit Unsubscribed(eventTypeId, listenerId);
    }

    /// @notice Dispatch an event to all subscribed listeners
    /// @param eventTypeId The event type to dispatch
    /// @param payload The event payload data
    /// @return listenerCount The number of listeners notified
    function dispatch(bytes32 eventTypeId, string calldata payload) external returns (uint256 listenerCount) {
        require(_eventTypes[eventTypeId].exists, "Event type not found");

        listenerCount = _listeners[eventTypeId].length;
        _dispatchCount++;

        emit Dispatched(eventTypeId, listenerCount);

        return listenerCount;
    }

    // --- Views ---

    /// @notice Get the number of listeners for an event type
    /// @param eventTypeId The event type ID
    /// @return The number of subscribed listeners
    function getListenerCount(bytes32 eventTypeId) external view returns (uint256) {
        return _listeners[eventTypeId].length;
    }

    /// @notice Check if an event type exists
    /// @param eventTypeId The event type ID
    /// @return Whether the event type is registered
    function eventTypeExists(bytes32 eventTypeId) external view returns (bool) {
        return _eventTypes[eventTypeId].exists;
    }
}
