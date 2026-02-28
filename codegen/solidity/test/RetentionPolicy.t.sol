// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RetentionPolicy.sol";

contract RetentionPolicyTest is Test {
    RetentionPolicy public target;

    event RetentionSet(bytes32 indexed policyId, string recordType);
    event HoldApplied(bytes32 indexed holdId, string name, bytes32 indexed issuer);
    event HoldReleased(bytes32 indexed holdId, bytes32 indexed releasedBy);
    event RecordDisposed(bytes32 indexed record, bytes32 indexed disposedBy);

    function setUp() public {
        target = new RetentionPolicy();
    }

    // --- setRetention tests ---

    function test_setRetention_creates_policy() public {
        bytes32 policyId = target.setRetention("email", 7, "years", "archive");

        RetentionPolicy.Policy memory p = target.getPolicy(policyId);
        assertEq(p.period, 7);
        assertEq(keccak256(bytes(p.recordType)), keccak256(bytes("email")));
        assertEq(keccak256(bytes(p.unit)), keccak256(bytes("years")));
        assertEq(keccak256(bytes(p.dispositionAction)), keccak256(bytes("archive")));
        assertTrue(p.exists);
    }

    function test_setRetention_emits_event() public {
        vm.expectEmit(false, false, false, true);
        emit RetentionSet(bytes32(0), "email");

        target.setRetention("email", 7, "years", "archive");
    }

    // --- applyHold tests ---

    function test_applyHold_creates_hold() public {
        bytes32 issuer = keccak256("legal-dept");
        bytes32 holdId = target.applyHold("litigation-2024", "all-emails", "Pending lawsuit", issuer);

        RetentionPolicy.Hold memory h = target.getHold(holdId);
        assertEq(keccak256(bytes(h.name)), keccak256(bytes("litigation-2024")));
        assertEq(keccak256(bytes(h.scope)), keccak256(bytes("all-emails")));
        assertEq(h.issuer, issuer);
        assertFalse(h.released);
        assertTrue(h.exists);
    }

    function test_applyHold_increments_active_count() public {
        assertEq(target.activeHoldCount(), 0);

        bytes32 issuer = keccak256("legal");
        target.applyHold("hold1", "scope1", "reason1", issuer);

        assertEq(target.activeHoldCount(), 1);
    }

    function test_applyHold_emits_event() public {
        bytes32 issuer = keccak256("legal");

        vm.expectEmit(false, false, false, true);
        emit HoldApplied(bytes32(0), "hold1", issuer);

        target.applyHold("hold1", "scope1", "reason1", issuer);
    }

    // --- dispose tests ---

    function test_dispose_while_held_reverts() public {
        bytes32 issuer = keccak256("legal");
        target.applyHold("hold1", "scope1", "reason1", issuer);

        bytes32 record = keccak256("record1");
        bytes32 disposer = keccak256("admin");

        vm.expectRevert("Record is under active hold");
        target.dispose(record, disposer);
    }

    function test_dispose_without_holds_succeeds() public {
        bytes32 record = keccak256("record1");
        bytes32 disposer = keccak256("admin");

        vm.expectEmit(true, true, false, false);
        emit RecordDisposed(record, disposer);

        target.dispose(record, disposer);
    }

    // --- releaseHold tests ---

    function test_releaseHold_then_dispose_succeeds() public {
        bytes32 issuer = keccak256("legal");
        bytes32 holdId = target.applyHold("hold1", "scope1", "reason1", issuer);

        bytes32 releasedBy = keccak256("judge");
        target.releaseHold(holdId, releasedBy, "Case settled");

        assertEq(target.activeHoldCount(), 0);

        bytes32 record = keccak256("record1");
        bytes32 disposer = keccak256("admin");
        target.dispose(record, disposer);
    }

    function test_releaseHold_marks_as_released() public {
        bytes32 issuer = keccak256("legal");
        bytes32 holdId = target.applyHold("hold1", "scope1", "reason1", issuer);

        target.releaseHold(holdId, keccak256("judge"), "Done");

        RetentionPolicy.Hold memory h = target.getHold(holdId);
        assertTrue(h.released);
    }

    function test_releaseHold_not_found_reverts() public {
        vm.expectRevert("Hold not found");
        target.releaseHold(keccak256("missing"), keccak256("judge"), "reason");
    }

    function test_releaseHold_already_released_reverts() public {
        bytes32 issuer = keccak256("legal");
        bytes32 holdId = target.applyHold("hold1", "scope1", "reason1", issuer);
        target.releaseHold(holdId, keccak256("judge"), "Done");

        vm.expectRevert("Hold already released");
        target.releaseHold(holdId, keccak256("judge"), "Again");
    }

    function test_releaseHold_emits_event() public {
        bytes32 issuer = keccak256("legal");
        bytes32 holdId = target.applyHold("hold1", "scope1", "reason1", issuer);
        bytes32 releasedBy = keccak256("judge");

        vm.expectEmit(true, true, false, false);
        emit HoldReleased(holdId, releasedBy);

        target.releaseHold(holdId, releasedBy, "Done");
    }

    // --- checkDisposition tests ---

    function test_checkDisposition_disposable_when_no_holds() public {
        bytes32 record = keccak256("record1");
        uint256 status = target.checkDisposition(record);
        assertEq(status, 0); // disposable
    }

    function test_checkDisposition_held_when_active_hold() public {
        bytes32 issuer = keccak256("legal");
        target.applyHold("hold1", "scope1", "reason1", issuer);

        bytes32 record = keccak256("record1");
        uint256 status = target.checkDisposition(record);
        assertEq(status, 2); // held
    }

    // --- getPolicy tests ---

    function test_getPolicy_not_found_reverts() public {
        vm.expectRevert("Policy not found");
        target.getPolicy(keccak256("missing"));
    }

    // --- getHold tests ---

    function test_getHold_not_found_reverts() public {
        vm.expectRevert("Hold not found");
        target.getHold(keccak256("missing"));
    }
}
