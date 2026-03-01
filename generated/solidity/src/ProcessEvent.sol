// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProcessEvent
/// @notice Append-only event log for process execution using Solidity events.
/// @dev Uses Solidity events as the append-only log; on-chain storage tracks cursors and counts.

contract ProcessEvent {

    // --- Types ---

    struct EventEntry {
        bytes32 eventId;
        bytes32 runRef;
        string eventType;
        string payload;
        uint256 timestamp;
    }

    // --- Storage ---

    /// @dev All events stored sequentially per run for query support
    mapping(bytes32 => EventEntry[]) private runEvents;

    /// @dev Global event counter for cursor tracking
    uint256 private globalCursor;

    /// @dev Per-run cursors (next index to read)
    mapping(bytes32 => uint256) private runCursors;

    // --- Events (Solidity events as the append-only log) ---

    event EventAppended(
        bytes32 indexed eventId,
        bytes32 indexed runRef,
        string eventType,
        string payload,
        uint256 timestamp,
        uint256 globalIndex
    );

    // --- Actions ---

    /// @notice Append a new event to the log
    function append(bytes32 eventId, bytes32 runRef, string calldata eventType, string calldata payload) external {
        uint256 ts = block.timestamp;
        uint256 gIdx = globalCursor;
        globalCursor++;

        runEvents[runRef].push(EventEntry({
            eventId: eventId,
            runRef: runRef,
            eventType: eventType,
            payload: payload,
            timestamp: ts
        }));

        emit EventAppended(eventId, runRef, eventType, payload, ts, gIdx);
    }

    /// @notice Query events for a run, starting from an offset with a limit
    function query(bytes32 runRef, uint256 offset, uint256 limit) external view returns (EventEntry[] memory) {
        EventEntry[] storage events = runEvents[runRef];
        uint256 total = events.length;

        if (offset >= total) {
            return new EventEntry[](0);
        }

        uint256 remaining = total - offset;
        uint256 count = limit < remaining ? limit : remaining;

        EventEntry[] memory result = new EventEntry[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = events[offset + i];
        }

        return result;
    }

    /// @notice Get the current cursor (total event count) for a run
    function getCursor(bytes32 runRef) external view returns (uint256) {
        return runEvents[runRef].length;
    }

    /// @notice Get the global cursor (total events across all runs)
    function getGlobalCursor() external view returns (uint256) {
        return globalCursor;
    }

    /// @notice Get total event count for a run
    function getEventCount(bytes32 runRef) external view returns (uint256) {
        return runEvents[runRef].length;
    }
}
