// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PessimisticLock.sol";

contract PessimisticLockTest is Test {
    PessimisticLock public target;

    event CheckedOut(bytes32 indexed lockId, bytes32 indexed resource, bytes32 indexed holder);
    event CheckedIn(bytes32 indexed lockId);
    event LockBroken(bytes32 indexed lockId, bytes32 indexed breaker, bytes32 previousHolder);
    event Renewed(bytes32 indexed lockId, uint256 newExpires);
    event AlreadyLocked(bytes32 indexed resource, bytes32 indexed currentHolder);

    function setUp() public {
        target = new PessimisticLock();
    }

    // --- checkOut tests ---

    function test_checkOut_grants_lock() public {
        bytes32 resource = keccak256("file.txt");
        bytes32 holder = keccak256("alice");

        bytes32 lockId = target.checkOut(resource, holder, 3600, "editing");

        assertTrue(lockId != bytes32(0));

        PessimisticLock.Lock memory lock = target.getLock(lockId);
        assertEq(lock.resource, resource);
        assertEq(lock.holder, holder);
        assertTrue(lock.active);
        assertTrue(lock.exists);
    }

    function test_checkOut_emits_event() public {
        bytes32 resource = keccak256("file.txt");
        bytes32 holder = keccak256("alice");

        vm.expectEmit(false, true, true, false);
        emit CheckedOut(bytes32(0), resource, holder);

        target.checkOut(resource, holder, 3600, "editing");
    }

    function test_checkOut_double_lock_returns_zero() public {
        bytes32 resource = keccak256("file.txt");
        bytes32 alice = keccak256("alice");
        bytes32 bob = keccak256("bob");

        target.checkOut(resource, alice, 3600, "editing");

        // Bob tries to lock the same resource
        bytes32 lockId = target.checkOut(resource, bob, 3600, "also editing");

        assertEq(lockId, bytes32(0));
    }

    function test_checkOut_after_expiry_succeeds() public {
        bytes32 resource = keccak256("file.txt");
        bytes32 alice = keccak256("alice");
        bytes32 bob = keccak256("bob");

        target.checkOut(resource, alice, 100, "editing");

        // Advance time past expiry
        vm.warp(block.timestamp + 200);

        bytes32 lockId = target.checkOut(resource, bob, 3600, "new edit");
        assertTrue(lockId != bytes32(0));

        PessimisticLock.Lock memory lock = target.getLock(lockId);
        assertEq(lock.holder, bob);
    }

    function test_checkOut_zero_resource_reverts() public {
        vm.expectRevert("Resource cannot be zero");
        target.checkOut(bytes32(0), keccak256("alice"), 3600, "reason");
    }

    function test_checkOut_zero_holder_reverts() public {
        vm.expectRevert("Holder cannot be zero");
        target.checkOut(keccak256("file"), bytes32(0), 3600, "reason");
    }

    function test_checkOut_zero_duration_reverts() public {
        vm.expectRevert("Duration must be positive");
        target.checkOut(keccak256("file"), keccak256("alice"), 0, "reason");
    }

    function test_checkOut_empty_reason_reverts() public {
        vm.expectRevert("Reason cannot be empty");
        target.checkOut(keccak256("file"), keccak256("alice"), 3600, "");
    }

    // --- checkIn tests ---

    function test_checkIn_releases_lock() public {
        bytes32 resource = keccak256("file.txt");
        bytes32 lockId = target.checkOut(resource, keccak256("alice"), 3600, "editing");

        target.checkIn(lockId);

        PessimisticLock.Lock memory lock = target.getLock(lockId);
        assertFalse(lock.active);

        // Resource should be available again
        assertEq(target.getActiveLock(resource), bytes32(0));
    }

    function test_checkIn_emits_event() public {
        bytes32 lockId = target.checkOut(keccak256("file"), keccak256("alice"), 3600, "editing");

        vm.expectEmit(true, false, false, false);
        emit CheckedIn(lockId);

        target.checkIn(lockId);
    }

    function test_checkIn_nonexistent_reverts() public {
        vm.expectRevert("Lock does not exist");
        target.checkIn(keccak256("fake"));
    }

    function test_checkIn_inactive_reverts() public {
        bytes32 lockId = target.checkOut(keccak256("file"), keccak256("alice"), 3600, "editing");
        target.checkIn(lockId);

        vm.expectRevert("Lock is not active");
        target.checkIn(lockId);
    }

    // --- breakLock tests ---

    function test_breakLock_force_releases() public {
        bytes32 resource = keccak256("file.txt");
        bytes32 alice = keccak256("alice");
        bytes32 admin = keccak256("admin");

        bytes32 lockId = target.checkOut(resource, alice, 3600, "editing");

        bytes32 previousHolder = target.breakLock(lockId, admin, "emergency");

        assertEq(previousHolder, alice);

        PessimisticLock.Lock memory lock = target.getLock(lockId);
        assertFalse(lock.active);
    }

    function test_breakLock_emits_event() public {
        bytes32 alice = keccak256("alice");
        bytes32 admin = keccak256("admin");
        bytes32 lockId = target.checkOut(keccak256("file"), alice, 3600, "editing");

        vm.expectEmit(true, true, false, true);
        emit LockBroken(lockId, admin, alice);

        target.breakLock(lockId, admin, "emergency");
    }

    function test_breakLock_nonexistent_reverts() public {
        vm.expectRevert("Lock does not exist");
        target.breakLock(keccak256("fake"), keccak256("admin"), "reason");
    }

    function test_breakLock_inactive_reverts() public {
        bytes32 lockId = target.checkOut(keccak256("file"), keccak256("alice"), 3600, "editing");
        target.checkIn(lockId);

        vm.expectRevert("Lock is not active");
        target.breakLock(lockId, keccak256("admin"), "reason");
    }

    // --- renew tests ---

    function test_renew_extends_expiration() public {
        bytes32 lockId = target.checkOut(keccak256("file"), keccak256("alice"), 3600, "editing");

        PessimisticLock.Lock memory before = target.getLock(lockId);
        uint256 originalExpires = before.expires;

        uint256 newExpires = target.renew(lockId, 1800);

        assertEq(newExpires, originalExpires + 1800);

        PessimisticLock.Lock memory after_ = target.getLock(lockId);
        assertEq(after_.expires, newExpires);
    }

    function test_renew_emits_event() public {
        bytes32 lockId = target.checkOut(keccak256("file"), keccak256("alice"), 3600, "editing");

        vm.expectEmit(true, false, false, false);
        emit Renewed(lockId, 0);

        target.renew(lockId, 1800);
    }

    function test_renew_nonexistent_reverts() public {
        vm.expectRevert("Lock does not exist");
        target.renew(keccak256("fake"), 1800);
    }

    function test_renew_inactive_reverts() public {
        bytes32 lockId = target.checkOut(keccak256("file"), keccak256("alice"), 3600, "editing");
        target.checkIn(lockId);

        vm.expectRevert("Lock is not active");
        target.renew(lockId, 1800);
    }

    function test_renew_zero_duration_reverts() public {
        bytes32 lockId = target.checkOut(keccak256("file"), keccak256("alice"), 3600, "editing");

        vm.expectRevert("Additional duration must be positive");
        target.renew(lockId, 0);
    }

    // --- queryLocks tests ---

    function test_queryLocks_returns_history() public {
        bytes32 resource = keccak256("file.txt");

        bytes32 lock1 = target.checkOut(resource, keccak256("alice"), 3600, "editing");
        target.checkIn(lock1);

        bytes32 lock2 = target.checkOut(resource, keccak256("bob"), 3600, "editing");

        bytes32[] memory history = target.queryLocks(resource);
        assertEq(history.length, 2);
        assertEq(history[0], lock1);
        assertEq(history[1], lock2);
    }

    function test_queryLocks_empty_for_unknown_resource() public view {
        bytes32[] memory history = target.queryLocks(keccak256("unknown"));
        assertEq(history.length, 0);
    }

    // --- getLock tests ---

    function test_getLock_nonexistent_reverts() public {
        vm.expectRevert("Lock does not exist");
        target.getLock(keccak256("fake"));
    }

    // --- getActiveLock tests ---

    function test_getActiveLock_returns_zero_when_none() public view {
        assertEq(target.getActiveLock(keccak256("resource")), bytes32(0));
    }
}
