// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EventBus.sol";

contract EventBusTest is Test {
    EventBus public target;

    event EventTypeRegistered(bytes32 indexed eventTypeId);
    event Subscribed(bytes32 indexed eventTypeId, bytes32 indexed listenerId);
    event Unsubscribed(bytes32 indexed eventTypeId, bytes32 indexed listenerId);
    event Dispatched(bytes32 indexed eventTypeId, uint256 listenerCount);

    function setUp() public {
        target = new EventBus();
    }

    // --- registerEventType tests ---

    function test_registerEventType_stores_type() public {
        bytes32 etId = keccak256("user.created");
        target.registerEventType(etId, '{"userId":"bytes32"}');

        assertTrue(target.eventTypeExists(etId), "Event type should exist");
    }

    function test_registerEventType_emits_event() public {
        bytes32 etId = keccak256("user.created");

        vm.expectEmit(true, false, false, false);
        emit EventTypeRegistered(etId);

        target.registerEventType(etId, "schema");
    }

    function test_registerEventType_zero_id_reverts() public {
        vm.expectRevert("Event type ID cannot be zero");
        target.registerEventType(bytes32(0), "schema");
    }

    function test_registerEventType_duplicate_reverts() public {
        bytes32 etId = keccak256("evt");
        target.registerEventType(etId, "schema");

        vm.expectRevert("Event type already exists");
        target.registerEventType(etId, "schema2");
    }

    // --- subscribe tests ---

    function test_subscribe_adds_listener() public {
        bytes32 etId = keccak256("evt");
        bytes32 listenerId = keccak256("listener1");
        target.registerEventType(etId, "schema");
        target.subscribe(etId, listenerId, 10);

        assertEq(target.getListenerCount(etId), 1, "Should have 1 listener");
    }

    function test_subscribe_nonexistent_type_reverts() public {
        vm.expectRevert("Event type not found");
        target.subscribe(keccak256("missing"), keccak256("l1"), 0);
    }

    function test_subscribe_zero_listener_reverts() public {
        bytes32 etId = keccak256("evt");
        target.registerEventType(etId, "schema");

        vm.expectRevert("Listener ID cannot be zero");
        target.subscribe(etId, bytes32(0), 0);
    }

    function test_subscribe_duplicate_reverts() public {
        bytes32 etId = keccak256("evt");
        bytes32 listenerId = keccak256("l1");
        target.registerEventType(etId, "schema");
        target.subscribe(etId, listenerId, 0);

        vm.expectRevert("Listener already subscribed");
        target.subscribe(etId, listenerId, 5);
    }

    // --- unsubscribe tests ---

    function test_unsubscribe_removes_listener() public {
        bytes32 etId = keccak256("evt");
        bytes32 listenerId = keccak256("l1");
        target.registerEventType(etId, "schema");
        target.subscribe(etId, listenerId, 0);
        target.unsubscribe(etId, listenerId);

        assertEq(target.getListenerCount(etId), 0, "Listener count should be 0");
    }

    function test_unsubscribe_not_subscribed_reverts() public {
        bytes32 etId = keccak256("evt");
        target.registerEventType(etId, "schema");

        vm.expectRevert("Listener not subscribed");
        target.unsubscribe(etId, keccak256("l1"));
    }

    // --- dispatch tests ---

    function test_dispatch_returns_listener_count() public {
        bytes32 etId = keccak256("evt");
        target.registerEventType(etId, "schema");
        target.subscribe(etId, keccak256("l1"), 0);
        target.subscribe(etId, keccak256("l2"), 0);

        uint256 count = target.dispatch(etId, "payload");
        assertEq(count, 2, "Should report 2 listeners");
    }

    function test_dispatch_nonexistent_type_reverts() public {
        vm.expectRevert("Event type not found");
        target.dispatch(keccak256("missing"), "payload");
    }

    function test_dispatch_zero_listeners() public {
        bytes32 etId = keccak256("evt");
        target.registerEventType(etId, "schema");

        uint256 count = target.dispatch(etId, "payload");
        assertEq(count, 0, "Should report 0 listeners");
    }

    // --- eventTypeExists tests ---

    function test_eventTypeExists_false_for_missing() public view {
        assertFalse(target.eventTypeExists(keccak256("missing")));
    }
}
