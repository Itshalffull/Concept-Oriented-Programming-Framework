// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessEvent.sol";

/// @title ProcessEvent Conformance Tests
/// @notice Tests for append-only event logging and query operations
contract ProcessEventTest is Test {
    ProcessEvent public target;

    bytes32 constant RUN_REF = keccak256("run-001");
    bytes32 constant RUN_REF_2 = keccak256("run-002");
    bytes32 constant EVT_1 = keccak256("evt-001");
    bytes32 constant EVT_2 = keccak256("evt-002");
    bytes32 constant EVT_3 = keccak256("evt-003");

    function setUp() public {
        target = new ProcessEvent();
    }

    /// @notice Appending an event increments the cursor
    function test_append_increments_cursor() public {
        assertEq(target.getCursor(RUN_REF), 0);

        target.append(EVT_1, RUN_REF, "StepStarted", '{"step":"a"}');
        assertEq(target.getCursor(RUN_REF), 1);

        target.append(EVT_2, RUN_REF, "StepCompleted", '{"step":"a"}');
        assertEq(target.getCursor(RUN_REF), 2);
    }

    /// @notice Appending emits the EventAppended Solidity event
    function test_append_emits_event() public {
        vm.expectEmit(true, true, false, true);
        emit ProcessEvent.EventAppended(EVT_1, RUN_REF, "StepStarted", '{"step":"a"}', block.timestamp, 0);

        target.append(EVT_1, RUN_REF, "StepStarted", '{"step":"a"}');
    }

    /// @notice Query returns events within offset and limit
    function test_query_with_offset_and_limit() public {
        target.append(EVT_1, RUN_REF, "Start", "p1");
        target.append(EVT_2, RUN_REF, "Middle", "p2");
        target.append(EVT_3, RUN_REF, "End", "p3");

        // Query all
        ProcessEvent.EventEntry[] memory all = target.query(RUN_REF, 0, 10);
        assertEq(all.length, 3);
        assertEq(all[0].eventId, EVT_1);
        assertEq(all[2].eventId, EVT_3);

        // Query with offset
        ProcessEvent.EventEntry[] memory fromOne = target.query(RUN_REF, 1, 10);
        assertEq(fromOne.length, 2);
        assertEq(fromOne[0].eventId, EVT_2);

        // Query with limit
        ProcessEvent.EventEntry[] memory limited = target.query(RUN_REF, 0, 2);
        assertEq(limited.length, 2);
        assertEq(limited[1].eventId, EVT_2);
    }

    /// @notice Query with offset beyond range returns empty
    function test_query_offset_beyond_range() public {
        target.append(EVT_1, RUN_REF, "Start", "p1");

        ProcessEvent.EventEntry[] memory result = target.query(RUN_REF, 5, 10);
        assertEq(result.length, 0);
    }

    /// @notice Query on empty run returns empty
    function test_query_empty_run() public view {
        ProcessEvent.EventEntry[] memory result = target.query(keccak256("empty"), 0, 10);
        assertEq(result.length, 0);
    }

    /// @notice Global cursor tracks across all runs
    function test_global_cursor() public {
        assertEq(target.getGlobalCursor(), 0);

        target.append(EVT_1, RUN_REF, "Start", "p1");
        target.append(EVT_2, RUN_REF_2, "Start", "p2");
        target.append(EVT_3, RUN_REF, "End", "p3");

        assertEq(target.getGlobalCursor(), 3);
        assertEq(target.getCursor(RUN_REF), 2);
        assertEq(target.getCursor(RUN_REF_2), 1);
    }

    /// @notice Event entries store correct data
    function test_event_data_integrity() public {
        target.append(EVT_1, RUN_REF, "ProcessStarted", '{"name":"order"}');

        ProcessEvent.EventEntry[] memory events = target.query(RUN_REF, 0, 1);
        assertEq(events.length, 1);
        assertEq(events[0].eventId, EVT_1);
        assertEq(events[0].runRef, RUN_REF);
        assertEq(events[0].eventType, "ProcessStarted");
        assertEq(events[0].payload, '{"name":"order"}');
        assertGt(events[0].timestamp, 0);
    }

    /// @notice getEventCount matches getCursor
    function test_getEventCount() public {
        target.append(EVT_1, RUN_REF, "A", "");
        target.append(EVT_2, RUN_REF, "B", "");

        assertEq(target.getEventCount(RUN_REF), 2);
        assertEq(target.getEventCount(RUN_REF), target.getCursor(RUN_REF));
    }
}
