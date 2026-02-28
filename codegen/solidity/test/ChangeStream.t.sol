// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ChangeStream.sol";

contract ChangeStreamTest is Test {
    ChangeStream public target;

    event EventAppended(uint256 indexed offset, bytes32 indexed eventId, string eventType);
    event Subscribed(bytes32 indexed subscriptionId, uint256 fromOffset);
    event Acknowledged(bytes32 indexed consumer, uint256 offset);

    function setUp() public {
        target = new ChangeStream();
    }

    // --- append tests ---

    function test_append_increments_offset() public {
        (uint256 offset1,) = target.append("create", "", "", keccak256("src1"));
        (uint256 offset2,) = target.append("update", "", "", keccak256("src1"));

        assertEq(offset1, 0);
        assertEq(offset2, 1);
    }

    function test_append_returns_unique_event_id() public {
        (, bytes32 id1) = target.append("create", "", "", keccak256("src1"));
        (, bytes32 id2) = target.append("create", "", "", keccak256("src1"));

        assertTrue(id1 != id2);
    }

    function test_append_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit EventAppended(0, bytes32(0), "create");

        target.append("create", "", "", keccak256("src1"));
    }

    function test_append_stores_event_data() public {
        bytes memory beforeState = hex"aabb";
        bytes memory afterState = hex"ccdd";
        bytes32 source = keccak256("src1");

        target.append("update", beforeState, afterState, source);

        ChangeStream.StreamEvent[] memory events = target.replay(0, 0);
        assertEq(events.length, 1);
        assertEq(events[0].eventType, "update");
        assertEq(events[0].source, source);
        assertEq(events[0].offset, 0);
    }

    // --- replay tests ---

    function test_replay_returns_range() public {
        target.append("create", "", "", keccak256("s"));
        target.append("update", "", "", keccak256("s"));
        target.append("delete", "", "", keccak256("s"));

        ChangeStream.StreamEvent[] memory events = target.replay(0, 2);
        assertEq(events.length, 3);
        assertEq(events[0].eventType, "create");
        assertEq(events[1].eventType, "update");
        assertEq(events[2].eventType, "delete");
    }

    function test_replay_partial_range() public {
        target.append("create", "", "", keccak256("s"));
        target.append("update", "", "", keccak256("s"));
        target.append("delete", "", "", keccak256("s"));

        ChangeStream.StreamEvent[] memory events = target.replay(1, 2);
        assertEq(events.length, 2);
        assertEq(events[0].eventType, "update");
        assertEq(events[1].eventType, "delete");
    }

    function test_replay_invalid_range_reverts() public {
        target.append("create", "", "", keccak256("s"));

        vm.expectRevert("Invalid range");
        target.replay(1, 0);
    }

    function test_replay_out_of_range_reverts() public {
        target.append("create", "", "", keccak256("s"));

        vm.expectRevert("Offset out of range");
        target.replay(0, 5);
    }

    // --- subscribe & read tests ---

    function test_subscribe_and_read() public {
        target.append("create", "", "", keccak256("s"));
        target.append("update", "", "", keccak256("s"));

        bytes32 subId = target.subscribe(0);

        ChangeStream.StreamEvent[] memory events = target.read(subId, 10);
        assertEq(events.length, 2);
        assertEq(events[0].eventType, "create");
        assertEq(events[1].eventType, "update");
    }

    function test_subscribe_from_middle() public {
        target.append("create", "", "", keccak256("s"));
        target.append("update", "", "", keccak256("s"));
        target.append("delete", "", "", keccak256("s"));

        bytes32 subId = target.subscribe(1);

        ChangeStream.StreamEvent[] memory events = target.read(subId, 10);
        assertEq(events.length, 2);
        assertEq(events[0].eventType, "update");
    }

    function test_read_respects_max_count() public {
        target.append("create", "", "", keccak256("s"));
        target.append("update", "", "", keccak256("s"));
        target.append("delete", "", "", keccak256("s"));

        bytes32 subId = target.subscribe(0);

        ChangeStream.StreamEvent[] memory events = target.read(subId, 2);
        assertEq(events.length, 2);
    }

    function test_subscribe_out_of_range_reverts() public {
        vm.expectRevert("Offset out of range");
        target.subscribe(1);
    }

    // --- acknowledge tests ---

    function test_acknowledge_updates_consumer_position() public {
        target.append("create", "", "", keccak256("s"));
        target.append("update", "", "", keccak256("s"));

        bytes32 consumer = keccak256("consumer1");
        target.acknowledge(consumer, 1);

        assertEq(target.getConsumerOffset(consumer), 1);
    }

    function test_acknowledge_emits_event() public {
        target.append("create", "", "", keccak256("s"));
        bytes32 consumer = keccak256("consumer1");

        vm.expectEmit(true, false, false, true);
        emit Acknowledged(consumer, 0);

        target.acknowledge(consumer, 0);
    }

    function test_acknowledge_out_of_range_reverts() public {
        vm.expectRevert("Offset out of range");
        target.acknowledge(keccak256("consumer1"), 0);
    }

    // --- getNextOffset tests ---

    function test_getNextOffset_starts_at_zero() public {
        assertEq(target.getNextOffset(), 0);
    }

    function test_getNextOffset_increments() public {
        target.append("create", "", "", keccak256("s"));
        assertEq(target.getNextOffset(), 1);
    }
}
