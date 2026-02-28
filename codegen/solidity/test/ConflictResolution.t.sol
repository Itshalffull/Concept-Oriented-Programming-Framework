// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConflictResolution.sol";

contract ConflictResolutionTest is Test {
    ConflictResolution public target;

    event PolicyRegistered(bytes32 indexed policyId, string name, uint256 priority);
    event ConflictDetected(bytes32 indexed conflictId, string context);
    event ConflictResolved(bytes32 indexed conflictId, bool automatic);
    event NoConflict(bytes32 indexed base);

    function setUp() public {
        target = new ConflictResolution();
    }

    // --- registerPolicy tests ---

    function test_registerPolicy_stores_policy() public {
        bytes32 policyId = target.registerPolicy("last-writer-wins", 10);

        ConflictResolution.PolicyInfo memory info = target.getPolicy(policyId);
        assertEq(info.name, "last-writer-wins");
        assertEq(info.priority, 10);
        assertTrue(info.exists);
    }

    function test_registerPolicy_emits_event() public {
        vm.expectEmit(false, false, false, true);
        emit PolicyRegistered(bytes32(0), "lww", 5);

        target.registerPolicy("lww", 5);
    }

    function test_registerPolicy_empty_name_reverts() public {
        vm.expectRevert("Policy name cannot be empty");
        target.registerPolicy("", 1);
    }

    function test_registerPolicy_duplicate_reverts() public {
        target.registerPolicy("lww", 10);

        vm.expectRevert("Policy already exists");
        target.registerPolicy("lww", 10);
    }

    // --- detect tests ---

    function test_detect_returns_conflictId_when_different() public {
        bytes memory base = "original";
        bytes memory v1 = "version-a";
        bytes memory v2 = "version-b";

        bytes32 conflictId = target.detect(base, v1, v2, "merge conflict");

        assertTrue(conflictId != bytes32(0));

        ConflictResolution.ConflictInfo memory info = target.getConflict(conflictId);
        assertEq(keccak256(info.base), keccak256(base));
        assertEq(keccak256(info.version1), keccak256(v1));
        assertEq(keccak256(info.version2), keccak256(v2));
        assertEq(info.context, "merge conflict");
        assertFalse(info.resolved);
    }

    function test_detect_returns_zero_when_identical() public {
        bytes memory base = "original";
        bytes memory v = "same-version";

        bytes32 conflictId = target.detect(base, v, v, "no diff");
        assertEq(conflictId, bytes32(0));
    }

    function test_detect_empty_base_reverts() public {
        vm.expectRevert("Base cannot be empty");
        target.detect("", "v1", "v2", "ctx");
    }

    function test_detect_adds_to_pending() public {
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");

        bytes32[] memory pending = target.getPendingConflicts();
        assertEq(pending.length, 1);
        assertEq(pending[0], conflictId);
    }

    // --- resolve tests ---

    function test_resolve_with_policy_resolves_automatically() public {
        bytes32 policyId = target.registerPolicy("lww", 10);
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");

        (bool resolved, bytes memory result) = target.resolve(conflictId, policyId);

        assertTrue(resolved);
        assertEq(keccak256(result), keccak256("v1"));

        ConflictResolution.ConflictInfo memory info = target.getConflict(conflictId);
        assertTrue(info.resolved);
    }

    function test_resolve_without_policy_requires_human() public {
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");

        (bool resolved,) = target.resolve(conflictId, bytes32(0));

        assertFalse(resolved);

        ConflictResolution.ConflictInfo memory info = target.getConflict(conflictId);
        assertTrue(info.requiresHuman);
        assertFalse(info.resolved);
    }

    function test_resolve_nonexistent_reverts() public {
        vm.expectRevert("Conflict does not exist");
        target.resolve(keccak256("fake"), bytes32(0));
    }

    function test_resolve_already_resolved_reverts() public {
        bytes32 policyId = target.registerPolicy("lww", 10);
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");
        target.resolve(conflictId, policyId);

        vm.expectRevert("Conflict already resolved");
        target.resolve(conflictId, policyId);
    }

    function test_resolve_removes_from_pending() public {
        bytes32 policyId = target.registerPolicy("lww", 10);
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");
        target.resolve(conflictId, policyId);

        bytes32[] memory pending = target.getPendingConflicts();
        assertEq(pending.length, 0);
    }

    // --- manualResolve tests ---

    function test_manualResolve_applies_chosen_resolution() public {
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");
        bytes memory chosen = "manually-merged-result";

        bytes memory result = target.manualResolve(conflictId, chosen);

        assertEq(keccak256(result), keccak256(chosen));

        ConflictResolution.ConflictInfo memory info = target.getConflict(conflictId);
        assertTrue(info.resolved);
        assertEq(keccak256(info.resolution), keccak256(chosen));
    }

    function test_manualResolve_emits_event() public {
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");

        vm.expectEmit(true, false, false, true);
        emit ConflictResolved(conflictId, false);

        target.manualResolve(conflictId, "chosen");
    }

    function test_manualResolve_nonexistent_reverts() public {
        vm.expectRevert("Conflict does not exist");
        target.manualResolve(keccak256("fake"), "chosen");
    }

    function test_manualResolve_already_resolved_reverts() public {
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");
        target.manualResolve(conflictId, "chosen");

        vm.expectRevert("Conflict already resolved");
        target.manualResolve(conflictId, "other");
    }

    function test_manualResolve_empty_chosen_reverts() public {
        bytes32 conflictId = target.detect("base", "v1", "v2", "ctx");

        vm.expectRevert("Resolution cannot be empty");
        target.manualResolve(conflictId, "");
    }

    // --- getPolicy tests ---

    function test_getPolicy_nonexistent_reverts() public {
        vm.expectRevert("Policy does not exist");
        target.getPolicy(keccak256("unknown"));
    }

    // --- getConflict tests ---

    function test_getConflict_nonexistent_reverts() public {
        vm.expectRevert("Conflict does not exist");
        target.getConflict(keccak256("unknown"));
    }
}
