// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChangeStream
/// @notice Ordered, resumable stream of atomic change events with subscription and replay support.
contract ChangeStream {
    struct StreamEvent {
        string eventType;
        bytes beforeData;
        bytes afterData;
        bytes32 source;
        uint256 timestamp;
        uint256 offset;
    }

    mapping(uint256 => StreamEvent) private _events;
    uint256 private _nextOffset;
    mapping(bytes32 => uint256) private _consumerOffset;
    mapping(bytes32 => uint256) private _subscriptionOffset;
    uint256 private _subscriptionNonce;

    event EventAppended(uint256 indexed offset, bytes32 indexed eventId, string eventType);
    event Subscribed(bytes32 indexed subscriptionId, uint256 fromOffset);
    event Acknowledged(bytes32 indexed consumer, uint256 offset);

    /// @notice Appends a new change event to the stream.
    /// @param eventType The type of change event.
    /// @param beforeState The state before the change.
    /// @param afterState The state after the change.
    /// @param source The source identifier of the change.
    /// @return offset The offset at which the event was stored.
    /// @return eventId A unique identifier for this event.
    function append(
        string calldata eventType,
        bytes calldata beforeState,
        bytes calldata afterState,
        bytes32 source
    ) external returns (uint256 offset, bytes32 eventId) {
        offset = _nextOffset++;
        eventId = keccak256(abi.encodePacked(eventType, source, block.timestamp, offset));

        _events[offset] = StreamEvent({
            eventType: eventType,
            beforeData: beforeState,
            afterData: afterState,
            source: source,
            timestamp: block.timestamp,
            offset: offset
        });

        emit EventAppended(offset, eventId, eventType);
    }

    /// @notice Creates a subscription starting from a given offset.
    /// @param fromOffset The offset to begin reading from.
    /// @return subscriptionId The unique identifier for the subscription.
    function subscribe(uint256 fromOffset) external returns (bytes32 subscriptionId) {
        require(fromOffset <= _nextOffset, "Offset out of range");

        subscriptionId = keccak256(abi.encodePacked(msg.sender, fromOffset, block.timestamp, _subscriptionNonce++));
        _subscriptionOffset[subscriptionId] = fromOffset;

        emit Subscribed(subscriptionId, fromOffset);
    }

    /// @notice Reads events from a subscription up to a maximum count.
    /// @param subscriptionId The subscription to read from.
    /// @param maxCount The maximum number of events to return.
    /// @return events The array of stream events.
    function read(bytes32 subscriptionId, uint256 maxCount) external view returns (StreamEvent[] memory events) {
        uint256 start = _subscriptionOffset[subscriptionId];
        uint256 available = _nextOffset > start ? _nextOffset - start : 0;
        uint256 count = available < maxCount ? available : maxCount;

        events = new StreamEvent[](count);
        for (uint256 i = 0; i < count; i++) {
            events[i] = _events[start + i];
        }
    }

    /// @notice Acknowledges that a consumer has processed events up to a given offset.
    /// @param consumer The consumer identifier.
    /// @param offset The offset up to which events have been processed.
    function acknowledge(bytes32 consumer, uint256 offset) external {
        require(offset < _nextOffset, "Offset out of range");

        _consumerOffset[consumer] = offset;

        emit Acknowledged(consumer, offset);
    }

    /// @notice Replays events between two offsets (inclusive).
    /// @param fromOffset The starting offset.
    /// @param toOffset The ending offset (inclusive).
    /// @return events The array of stream events in the range.
    function replay(uint256 fromOffset, uint256 toOffset) external view returns (StreamEvent[] memory events) {
        require(fromOffset <= toOffset, "Invalid range");
        require(toOffset < _nextOffset, "Offset out of range");

        uint256 count = toOffset - fromOffset + 1;
        events = new StreamEvent[](count);
        for (uint256 i = 0; i < count; i++) {
            events[i] = _events[fromOffset + i];
        }
    }

    /// @notice Returns the current consumer offset.
    /// @param consumer The consumer identifier.
    /// @return The last acknowledged offset.
    function getConsumerOffset(bytes32 consumer) external view returns (uint256) {
        return _consumerOffset[consumer];
    }

    /// @notice Returns the next offset that will be assigned.
    /// @return The next available offset.
    function getNextOffset() external view returns (uint256) {
        return _nextOffset;
    }
}
