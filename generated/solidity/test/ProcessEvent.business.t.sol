// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessEvent.sol";

/// @title ProcessEvent Business Logic Tests
/// @notice Tests for append-only log integrity, cursor management, pagination, and cross-run isolation
contract ProcessEventBusinessTest is Test {
    ProcessEvent private instance;

    bytes32 constant RUN_A = keccak256("biz-run-a");
    bytes32 constant RUN_B = keccak256("biz-run-b");

    function setUp() public {
        instance = new ProcessEvent();
    }

    // --- Helpers ---

    function _eventId(uint256 n) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("evt-", n));
    }

    // --- Full audit trail scenario ---

    /// @notice Simulate a complete process audit trail: start, step events, errors, completion
    function testCompleteAuditTrail() public {
        vm.warp(1000);
        instance.append(_eventId(1), RUN_A, "ProcessStarted", '{"spec":"order"}');

        vm.warp(1100);
        instance.append(_eventId(2), RUN_A, "StepStarted", '{"step":"validate"}');

        vm.warp(1200);
        instance.append(_eventId(3), RUN_A, "StepCompleted", '{"step":"validate","result":"ok"}');

        vm.warp(1300);
        instance.append(_eventId(4), RUN_A, "StepStarted", '{"step":"process"}');

        vm.warp(1400);
        instance.append(_eventId(5), RUN_A, "StepFailed", '{"step":"process","error":"timeout"}');

        vm.warp(1500);
        instance.append(_eventId(6), RUN_A, "ProcessFailed", '{"reason":"step failure"}');

        assertEq(instance.getEventCount(RUN_A), 6);
        assertEq(instance.getGlobalCursor(), 6);

        // Query the full trail
        ProcessEvent.EventEntry[] memory trail = instance.query(RUN_A, 0, 100);
        assertEq(trail.length, 6);
        assertEq(trail[0].eventType, "ProcessStarted");
        assertEq(trail[0].timestamp, 1000);
        assertEq(trail[5].eventType, "ProcessFailed");
        assertEq(trail[5].timestamp, 1500);
    }

    // --- Pagination ---

    /// @notice Paginate through events with offset and limit
    function testPaginationScenario() public {
        // Append 10 events
        for (uint256 i = 0; i < 10; i++) {
            instance.append(_eventId(i), RUN_A, "Event", "payload");
        }

        // Page 1: offset 0, limit 3
        ProcessEvent.EventEntry[] memory page1 = instance.query(RUN_A, 0, 3);
        assertEq(page1.length, 3);
        assertEq(page1[0].eventId, _eventId(0));

        // Page 2: offset 3, limit 3
        ProcessEvent.EventEntry[] memory page2 = instance.query(RUN_A, 3, 3);
        assertEq(page2.length, 3);
        assertEq(page2[0].eventId, _eventId(3));

        // Page 4: offset 9, limit 3 -> only 1 remaining
        ProcessEvent.EventEntry[] memory lastPage = instance.query(RUN_A, 9, 3);
        assertEq(lastPage.length, 1);
        assertEq(lastPage[0].eventId, _eventId(9));
    }

    /// @notice Query with limit 0 returns empty
    function testQueryLimitZero() public {
        instance.append(_eventId(1), RUN_A, "Start", "");

        ProcessEvent.EventEntry[] memory result = instance.query(RUN_A, 0, 0);
        assertEq(result.length, 0);
    }

    /// @notice Query with offset at exactly the count returns empty
    function testQueryOffsetAtExactCount() public {
        instance.append(_eventId(1), RUN_A, "A", "");
        instance.append(_eventId(2), RUN_A, "B", "");

        ProcessEvent.EventEntry[] memory result = instance.query(RUN_A, 2, 10);
        assertEq(result.length, 0);
    }

    // --- Cross-run isolation ---

    /// @notice Events from different runs are fully isolated
    function testCrossRunIsolation() public {
        instance.append(_eventId(1), RUN_A, "StartA", "");
        instance.append(_eventId(2), RUN_A, "EndA", "");
        instance.append(_eventId(3), RUN_B, "StartB", "");

        assertEq(instance.getEventCount(RUN_A), 2);
        assertEq(instance.getEventCount(RUN_B), 1);

        ProcessEvent.EventEntry[] memory eventsA = instance.query(RUN_A, 0, 10);
        assertEq(eventsA.length, 2);
        assertEq(eventsA[0].eventType, "StartA");

        ProcessEvent.EventEntry[] memory eventsB = instance.query(RUN_B, 0, 10);
        assertEq(eventsB.length, 1);
        assertEq(eventsB[0].eventType, "StartB");
    }

    // --- Global cursor tracking ---

    /// @notice Global cursor increments across multiple runs
    function testGlobalCursorAcrossRuns() public {
        assertEq(instance.getGlobalCursor(), 0);

        instance.append(_eventId(1), RUN_A, "A1", "");
        assertEq(instance.getGlobalCursor(), 1);

        instance.append(_eventId(2), RUN_B, "B1", "");
        assertEq(instance.getGlobalCursor(), 2);

        instance.append(_eventId(3), RUN_A, "A2", "");
        assertEq(instance.getGlobalCursor(), 3);

        instance.append(_eventId(4), RUN_B, "B2", "");
        assertEq(instance.getGlobalCursor(), 4);

        // Per-run counts
        assertEq(instance.getCursor(RUN_A), 2);
        assertEq(instance.getCursor(RUN_B), 2);
    }

    // --- Event emission ---

    /// @notice EventAppended emits correct globalIndex for each append
    function testEventAppendedGlobalIndex() public {
        vm.warp(1000);

        vm.expectEmit(true, true, false, true);
        emit ProcessEvent.EventAppended(_eventId(1), RUN_A, "First", "p1", 1000, 0);
        instance.append(_eventId(1), RUN_A, "First", "p1");

        vm.expectEmit(true, true, false, true);
        emit ProcessEvent.EventAppended(_eventId(2), RUN_B, "Second", "p2", 1000, 1);
        instance.append(_eventId(2), RUN_B, "Second", "p2");
    }

    // --- Timestamp integrity ---

    /// @notice Each event records the block.timestamp at the time of append
    function testTimestampsPerEvent() public {
        vm.warp(100);
        instance.append(_eventId(1), RUN_A, "E1", "");

        vm.warp(200);
        instance.append(_eventId(2), RUN_A, "E2", "");

        vm.warp(300);
        instance.append(_eventId(3), RUN_A, "E3", "");

        ProcessEvent.EventEntry[] memory events = instance.query(RUN_A, 0, 10);
        assertEq(events[0].timestamp, 100);
        assertEq(events[1].timestamp, 200);
        assertEq(events[2].timestamp, 300);
    }

    // --- Data integrity ---

    /// @notice Event payload and type are stored correctly for retrieval
    function testEventPayloadIntegrity() public {
        string memory longPayload = '{"orderId":"ORD-12345","amount":99.99,"items":["widget","gadget"],"shipping":{"method":"express","address":"123 Main St"}}';
        instance.append(_eventId(1), RUN_A, "OrderCreated", longPayload);

        ProcessEvent.EventEntry[] memory events = instance.query(RUN_A, 0, 1);
        assertEq(events[0].eventType, "OrderCreated");
        assertEq(events[0].payload, longPayload);
    }

    /// @notice Empty payload and empty eventType are valid
    function testEmptyPayloadAndType() public {
        instance.append(_eventId(1), RUN_A, "", "");

        ProcessEvent.EventEntry[] memory events = instance.query(RUN_A, 0, 1);
        assertEq(events[0].eventType, "");
        assertEq(events[0].payload, "");
    }

    /// @notice getCursor and getEventCount return the same value
    function testCursorEqualsEventCount() public {
        instance.append(_eventId(1), RUN_A, "A", "");
        instance.append(_eventId(2), RUN_A, "B", "");
        instance.append(_eventId(3), RUN_A, "C", "");

        assertEq(instance.getCursor(RUN_A), instance.getEventCount(RUN_A));
        assertEq(instance.getCursor(RUN_A), 3);
    }
}
