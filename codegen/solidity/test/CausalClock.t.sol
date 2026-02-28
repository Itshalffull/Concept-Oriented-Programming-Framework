// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CausalClock.sol";

contract CausalClockTest is Test {
    CausalClock public target;

    event ReplicaRegistered(bytes32 indexed replicaId, uint256 index);
    event Ticked(bytes32 indexed replicaId, bytes32 indexed eventId);
    event Merged(bytes32 indexed replicaA, bytes32 indexed replicaB);

    function setUp() public {
        target = new CausalClock();
    }

    // --- registerReplica tests ---

    function test_registerReplica_assigns_index() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        assertEq(target.getReplicaCount(), 1);
    }

    function test_registerReplica_emits_event() public {
        bytes32 r1 = keccak256("replica1");

        vm.expectEmit(true, false, false, true);
        emit ReplicaRegistered(r1, 0);

        target.registerReplica(r1);
    }

    function test_registerReplica_zero_reverts() public {
        vm.expectRevert("Replica ID cannot be zero");
        target.registerReplica(bytes32(0));
    }

    function test_registerReplica_duplicate_reverts() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        vm.expectRevert("Replica already registered");
        target.registerReplica(r1);
    }

    // --- tick tests ---

    function test_tick_increments_clock() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        (bytes32 eventId, uint256[] memory clock) = target.tick(r1);

        assertTrue(eventId != bytes32(0));
        assertEq(clock.length, 1);
        assertEq(clock[0], 1);
    }

    function test_tick_multiple_increments() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        target.tick(r1);
        (, uint256[] memory clock2) = target.tick(r1);

        assertEq(clock2[0], 2);
    }

    function test_tick_unregistered_reverts() public {
        vm.expectRevert("Replica not registered");
        target.tick(keccak256("unknown"));
    }

    function test_tick_emits_event() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        vm.expectEmit(true, false, false, false);
        emit Ticked(r1, bytes32(0));

        target.tick(r1);
    }

    // --- merge tests ---

    function test_merge_computes_componentwise_max() public {
        bytes32 r1 = keccak256("replica1");
        bytes32 r2 = keccak256("replica2");
        target.registerReplica(r1);
        target.registerReplica(r2);

        // r1 ticks twice: clock = [2, 0]
        target.tick(r1);
        target.tick(r1);

        // r2 ticks three times: clock = [0, 3]
        target.tick(r2);
        target.tick(r2);
        target.tick(r2);

        // Merge r2 into r1 -> r1 clock should be [2, 3]
        uint256[] memory merged = target.merge(r1, r2);

        assertEq(merged.length, 2);
        assertEq(merged[0], 2);
        assertEq(merged[1], 3);
    }

    function test_merge_unregistered_A_reverts() public {
        bytes32 r2 = keccak256("replica2");
        target.registerReplica(r2);

        vm.expectRevert("Replica A not registered");
        target.merge(keccak256("unknown"), r2);
    }

    function test_merge_unregistered_B_reverts() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        vm.expectRevert("Replica B not registered");
        target.merge(r1, keccak256("unknown"));
    }

    // --- compare tests ---

    function test_compare_before_ordering() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        // eventA happens first
        (bytes32 eventA,) = target.tick(r1);
        // eventB happens after
        (bytes32 eventB,) = target.tick(r1);

        CausalClock.Ordering result = target.compare(eventA, eventB);
        assertTrue(result == CausalClock.Ordering.Before);
    }

    function test_compare_after_ordering() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        (bytes32 eventA,) = target.tick(r1);
        (bytes32 eventB,) = target.tick(r1);

        CausalClock.Ordering result = target.compare(eventB, eventA);
        assertTrue(result == CausalClock.Ordering.After);
    }

    function test_compare_concurrent_ordering() public {
        bytes32 r1 = keccak256("replica1");
        bytes32 r2 = keccak256("replica2");
        target.registerReplica(r1);
        target.registerReplica(r2);

        // Each replica ticks independently -> concurrent
        (bytes32 eventA,) = target.tick(r1);
        (bytes32 eventB,) = target.tick(r2);

        CausalClock.Ordering result = target.compare(eventA, eventB);
        assertTrue(result == CausalClock.Ordering.Concurrent);
    }

    function test_compare_nonexistent_event_reverts() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);
        (bytes32 eventA,) = target.tick(r1);

        vm.expectRevert("Event B does not exist");
        target.compare(eventA, keccak256("fake"));
    }

    // --- dominates tests ---

    function test_dominates_true_when_after() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        (bytes32 eventA,) = target.tick(r1);
        (bytes32 eventB,) = target.tick(r1);

        assertTrue(target.dominates(eventB, eventA));
    }

    function test_dominates_false_when_before() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        (bytes32 eventA,) = target.tick(r1);
        (bytes32 eventB,) = target.tick(r1);

        assertFalse(target.dominates(eventA, eventB));
    }

    function test_dominates_false_when_concurrent() public {
        bytes32 r1 = keccak256("replica1");
        bytes32 r2 = keccak256("replica2");
        target.registerReplica(r1);
        target.registerReplica(r2);

        (bytes32 eventA,) = target.tick(r1);
        (bytes32 eventB,) = target.tick(r2);

        assertFalse(target.dominates(eventA, eventB));
        assertFalse(target.dominates(eventB, eventA));
    }

    // --- getClock tests ---

    function test_getClock_returns_current_state() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);
        target.tick(r1);

        uint256[] memory clock = target.getClock(r1);
        assertEq(clock[0], 1);
    }

    function test_getClock_unregistered_reverts() public {
        vm.expectRevert("Replica not registered");
        target.getClock(keccak256("unknown"));
    }

    // --- getEventClock tests ---

    function test_getEventClock_returns_snapshot() public {
        bytes32 r1 = keccak256("replica1");
        target.registerReplica(r1);

        (bytes32 eventId,) = target.tick(r1);

        uint256[] memory clock = target.getEventClock(eventId);
        assertEq(clock[0], 1);
    }

    function test_getEventClock_nonexistent_reverts() public {
        vm.expectRevert("Event does not exist");
        target.getEventClock(keccak256("fake"));
    }
}
