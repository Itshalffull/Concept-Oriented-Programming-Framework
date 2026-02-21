// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Queue.sol";

contract QueueTest is Test {
    Queue public target;

    event Enqueued(bytes32 indexed queueId, bytes32 indexed itemId);
    event Claimed(bytes32 indexed itemId);
    event Released(bytes32 indexed itemId);
    event ItemDeleted(bytes32 indexed itemId);

    function setUp() public {
        target = new Queue();
    }

    // --- enqueue tests ---

    function test_enqueue_stores_item() public {
        bytes32 qid = keccak256("q1");
        bytes32 iid = keccak256("i1");
        target.enqueue(qid, iid, '{"task":"process"}');

        Queue.QueueItem memory item = target.getItem(iid);
        assertEq(item.queueId, qid);
        assertEq(item.data, '{"task":"process"}');
        assertFalse(item.claimed);
        assertTrue(item.exists);
    }

    function test_enqueue_emits_event() public {
        bytes32 qid = keccak256("q1");
        bytes32 iid = keccak256("i1");

        vm.expectEmit(true, true, false, false);
        emit Enqueued(qid, iid);

        target.enqueue(qid, iid, "data");
    }

    function test_enqueue_zero_queue_id_reverts() public {
        vm.expectRevert("Queue ID cannot be zero");
        target.enqueue(bytes32(0), keccak256("i1"), "data");
    }

    function test_enqueue_zero_item_id_reverts() public {
        vm.expectRevert("Item ID cannot be zero");
        target.enqueue(keccak256("q1"), bytes32(0), "data");
    }

    function test_enqueue_duplicate_item_reverts() public {
        bytes32 qid = keccak256("q1");
        bytes32 iid = keccak256("i1");
        target.enqueue(qid, iid, "data");

        vm.expectRevert("Item already exists");
        target.enqueue(qid, iid, "other");
    }

    // --- claim tests ---

    function test_claim_sets_claimed_true() public {
        bytes32 qid = keccak256("q1");
        bytes32 iid = keccak256("i1");
        target.enqueue(qid, iid, "data");
        target.claim(iid);

        Queue.QueueItem memory item = target.getItem(iid);
        assertTrue(item.claimed);
    }

    function test_claim_emits_event() public {
        bytes32 iid = keccak256("i1");
        target.enqueue(keccak256("q1"), iid, "data");

        vm.expectEmit(true, false, false, false);
        emit Claimed(iid);

        target.claim(iid);
    }

    function test_claim_nonexistent_reverts() public {
        vm.expectRevert("Item not found");
        target.claim(keccak256("nonexistent"));
    }

    function test_claim_already_claimed_reverts() public {
        bytes32 iid = keccak256("i1");
        target.enqueue(keccak256("q1"), iid, "data");
        target.claim(iid);

        vm.expectRevert("Item already claimed");
        target.claim(iid);
    }

    // --- release tests ---

    function test_release_sets_claimed_false() public {
        bytes32 iid = keccak256("i1");
        target.enqueue(keccak256("q1"), iid, "data");
        target.claim(iid);
        target.release(iid);

        Queue.QueueItem memory item = target.getItem(iid);
        assertFalse(item.claimed);
    }

    function test_release_emits_event() public {
        bytes32 iid = keccak256("i1");
        target.enqueue(keccak256("q1"), iid, "data");
        target.claim(iid);

        vm.expectEmit(true, false, false, false);
        emit Released(iid);

        target.release(iid);
    }

    function test_release_nonexistent_reverts() public {
        vm.expectRevert("Item not found");
        target.release(keccak256("nonexistent"));
    }

    function test_release_not_claimed_reverts() public {
        bytes32 iid = keccak256("i1");
        target.enqueue(keccak256("q1"), iid, "data");

        vm.expectRevert("Item not claimed");
        target.release(iid);
    }

    // --- deleteItem tests ---

    function test_deleteItem_removes_item() public {
        bytes32 iid = keccak256("i1");
        target.enqueue(keccak256("q1"), iid, "data");
        target.deleteItem(iid);

        vm.expectRevert("Item not found");
        target.getItem(iid);
    }

    function test_deleteItem_emits_event() public {
        bytes32 iid = keccak256("i1");
        target.enqueue(keccak256("q1"), iid, "data");

        vm.expectEmit(true, false, false, false);
        emit ItemDeleted(iid);

        target.deleteItem(iid);
    }

    function test_deleteItem_nonexistent_reverts() public {
        vm.expectRevert("Item not found");
        target.deleteItem(keccak256("nonexistent"));
    }

    // --- getItem tests ---

    function test_getItem_nonexistent_reverts() public {
        vm.expectRevert("Item not found");
        target.getItem(keccak256("nonexistent"));
    }

    // --- queueLength tests ---

    function test_queueLength_starts_at_zero() public {
        assertEq(target.queueLength(keccak256("q1")), 0);
    }

    function test_queueLength_increments() public {
        bytes32 qid = keccak256("q1");
        target.enqueue(qid, keccak256("i1"), "d1");
        target.enqueue(qid, keccak256("i2"), "d2");
        target.enqueue(qid, keccak256("i3"), "d3");

        assertEq(target.queueLength(qid), 3);
    }
}
