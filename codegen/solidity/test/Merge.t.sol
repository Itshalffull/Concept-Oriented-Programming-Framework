// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Merge.sol";

contract MergeTest is Test {
    Merge public target;

    event StrategyRegistered(bytes32 indexed strategyId, string name);
    event CleanMerge(bytes32 indexed mergeId, bytes result);
    event ConflictsDetected(bytes32 indexed mergeId, uint256 conflictCount);
    event ConflictResolved(bytes32 indexed mergeId, uint256 conflictIndex, uint256 remaining);
    event MergeFinalized(bytes32 indexed mergeId, bytes result);

    bytes32 internal _strategyId;

    function setUp() public {
        target = new Merge();
        string[] memory types = new string[](0);
        _strategyId = target.registerStrategy("recursive", types);
    }

    // --- registerStrategy tests ---

    function test_registerStrategy_stores_strategy() public {
        string[] memory types = new string[](1);
        types[0] = "text/plain";

        bytes32 sid = target.registerStrategy("patience", types);

        Merge.Strategy memory s = target.getStrategy(sid);
        assertEq(s.name, "patience");
        assertTrue(s.exists);
    }

    function test_registerStrategy_emits_event() public {
        string[] memory types = new string[](0);

        vm.expectEmit(false, false, false, true);
        emit StrategyRegistered(bytes32(0), "ort");

        target.registerStrategy("ort", types);
    }

    function test_registerStrategy_duplicate_reverts() public {
        string[] memory types = new string[](0);

        vm.expectRevert("Strategy name already registered");
        target.registerStrategy("recursive", types);
    }

    // --- merge: clean merge tests ---

    function test_merge_ours_equals_base_returns_theirs() public {
        bytes32 base = keccak256("base-content");
        bytes32 ours = base; // no changes on our side
        bytes32 theirs = keccak256("their-changes");

        (, bool isClean, bytes memory result) = target.merge(base, ours, theirs, _strategyId);

        assertTrue(isClean);
        assertEq(result, abi.encodePacked(theirs));
    }

    function test_merge_theirs_equals_base_returns_ours() public {
        bytes32 base = keccak256("base-content");
        bytes32 ours = keccak256("our-changes");
        bytes32 theirs = base; // no changes on their side

        (, bool isClean, bytes memory result) = target.merge(base, ours, theirs, _strategyId);

        assertTrue(isClean);
        assertEq(result, abi.encodePacked(ours));
    }

    function test_merge_ours_equals_theirs_returns_ours() public {
        bytes32 base = keccak256("base-content");
        bytes32 same = keccak256("same-changes");

        (, bool isClean, bytes memory result) = target.merge(base, same, same, _strategyId);

        assertTrue(isClean);
        assertEq(result, abi.encodePacked(same));
    }

    function test_merge_clean_emits_event() public {
        bytes32 base = keccak256("base");
        bytes32 theirs = keccak256("theirs");

        vm.expectEmit(false, false, false, true);
        emit CleanMerge(bytes32(0), abi.encodePacked(theirs));

        target.merge(base, base, theirs, _strategyId);
    }

    // --- merge: conflict tests ---

    function test_merge_both_changed_creates_conflicts() public {
        bytes32 base = keccak256("base-content");
        bytes32 ours = keccak256("our-changes");
        bytes32 theirs = keccak256("their-changes");

        (bytes32 mergeId, bool isClean,) = target.merge(base, ours, theirs, _strategyId);

        assertFalse(isClean);

        Merge.MergeSession memory session = target.getMergeSession(mergeId);
        assertEq(session.conflictCount, 1);
        assertEq(session.resolvedCount, 0);
        assertFalse(session.finalized);
    }

    function test_merge_conflicts_emits_event() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        vm.expectEmit(false, false, false, true);
        emit ConflictsDetected(bytes32(0), 1);

        target.merge(base, ours, theirs, _strategyId);
    }

    function test_merge_invalid_strategy_reverts() public {
        vm.expectRevert("Strategy does not exist");
        target.merge(keccak256("b"), keccak256("o"), keccak256("t"), keccak256("fake"));
    }

    // --- resolveConflict tests ---

    function test_resolveConflict_decrements_remaining() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        (bytes32 mergeId,,) = target.merge(base, ours, theirs, _strategyId);

        uint256 remaining = target.resolveConflict(mergeId, 0, "resolved-content");
        assertEq(remaining, 0);
    }

    function test_resolveConflict_emits_event() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        (bytes32 mergeId,,) = target.merge(base, ours, theirs, _strategyId);

        vm.expectEmit(true, false, false, true);
        emit ConflictResolved(mergeId, 0, 0);

        target.resolveConflict(mergeId, 0, "resolved");
    }

    function test_resolveConflict_nonexistent_session_reverts() public {
        vm.expectRevert("Merge session does not exist");
        target.resolveConflict(keccak256("fake"), 0, "data");
    }

    function test_resolveConflict_out_of_range_reverts() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        (bytes32 mergeId,,) = target.merge(base, ours, theirs, _strategyId);

        vm.expectRevert("Conflict index out of range");
        target.resolveConflict(mergeId, 5, "data");
    }

    // --- finalize tests ---

    function test_finalize_after_resolution() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        (bytes32 mergeId,,) = target.merge(base, ours, theirs, _strategyId);
        target.resolveConflict(mergeId, 0, "final-content");

        bytes memory result = target.finalize(mergeId);
        assertEq(result, "final-content");

        Merge.MergeSession memory session = target.getMergeSession(mergeId);
        assertTrue(session.finalized);
    }

    function test_finalize_emits_event() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        (bytes32 mergeId,,) = target.merge(base, ours, theirs, _strategyId);
        target.resolveConflict(mergeId, 0, "final-content");

        vm.expectEmit(true, false, false, true);
        emit MergeFinalized(mergeId, "final-content");

        target.finalize(mergeId);
    }

    function test_finalize_with_unresolved_conflicts_reverts() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        (bytes32 mergeId,,) = target.merge(base, ours, theirs, _strategyId);

        vm.expectRevert("Unresolved conflicts remain");
        target.finalize(mergeId);
    }

    function test_finalize_already_finalized_reverts() public {
        bytes32 base = keccak256("base");
        bytes32 ours = keccak256("ours");
        bytes32 theirs = keccak256("theirs");

        (bytes32 mergeId,,) = target.merge(base, ours, theirs, _strategyId);
        target.resolveConflict(mergeId, 0, "final");
        target.finalize(mergeId);

        vm.expectRevert("Merge already finalized");
        target.finalize(mergeId);
    }

    // --- getMergeSession tests ---

    function test_getMergeSession_nonexistent_reverts() public {
        vm.expectRevert("Merge session does not exist");
        target.getMergeSession(keccak256("fake"));
    }
}
