// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessRun.sol";

/// @title ProcessRun Business Logic Tests
/// @notice Tests for multi-step lifecycle, hierarchies, timestamp integrity, and invalid transition coverage
contract ProcessRunBusinessTest is Test {
    ProcessRun private instance;

    bytes32 constant RUN_ID = keccak256("biz-run-001");
    bytes32 constant RUN_ID_2 = keccak256("biz-run-002");
    bytes32 constant CHILD_1 = keccak256("child-001");
    bytes32 constant CHILD_2 = keccak256("child-002");
    bytes32 constant CHILD_3 = keccak256("child-003");
    bytes32 constant SPEC_REF = keccak256("spec-001");
    bytes32 constant SPEC_REF_2 = keccak256("spec-002");

    function setUp() public {
        instance = new ProcessRun();
    }

    // --- Full lifecycle with timestamps ---

    /// @notice Full lifecycle: start -> suspend -> resume -> suspend -> resume -> complete verifying timestamps
    function testFullLifecycleWithMultipleSuspendResumeCycles() public {
        vm.warp(1000);
        instance.startRun(RUN_ID, SPEC_REF);

        ProcessRun.RunView memory v1 = instance.getStatus(RUN_ID);
        assertEq(v1.startedAt, 1000);
        assertEq(v1.completedAt, 0);

        vm.warp(2000);
        instance.suspendRun(RUN_ID);
        ProcessRun.RunView memory v2 = instance.getStatus(RUN_ID);
        assertEq(uint8(v2.status), uint8(ProcessRun.Status.Suspended));
        // startedAt remains unchanged
        assertEq(v2.startedAt, 1000);

        vm.warp(3000);
        instance.resumeRun(RUN_ID);

        vm.warp(4000);
        instance.suspendRun(RUN_ID);

        vm.warp(5000);
        instance.resumeRun(RUN_ID);

        vm.warp(6000);
        instance.completeRun(RUN_ID);

        ProcessRun.RunView memory vFinal = instance.getStatus(RUN_ID);
        assertEq(uint8(vFinal.status), uint8(ProcessRun.Status.Completed));
        assertEq(vFinal.startedAt, 1000);
        assertEq(vFinal.completedAt, 6000);
    }

    /// @notice Start -> fail captures timestamps correctly
    function testStartToFailTimestamps() public {
        vm.warp(100);
        instance.startRun(RUN_ID, SPEC_REF);

        vm.warp(200);
        instance.failRun(RUN_ID);

        ProcessRun.RunView memory v = instance.getStatus(RUN_ID);
        assertEq(uint8(v.status), uint8(ProcessRun.Status.Failed));
        assertEq(v.startedAt, 100);
        assertEq(v.completedAt, 200);
    }

    /// @notice Cancel from Running captures completedAt
    function testCancelFromRunningTimestamp() public {
        vm.warp(500);
        instance.startRun(RUN_ID, SPEC_REF);

        vm.warp(600);
        instance.cancelRun(RUN_ID);

        ProcessRun.RunView memory v = instance.getStatus(RUN_ID);
        assertEq(v.completedAt, 600);
    }

    // --- Invalid state transitions ---

    /// @notice Cannot fail a Completed run
    function testRevertFailCompletedRun() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.completeRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Running to fail");
        instance.failRun(RUN_ID);
    }

    /// @notice Cannot fail a Suspended run
    function testRevertFailSuspendedRun() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.suspendRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Running to fail");
        instance.failRun(RUN_ID);
    }

    /// @notice Cannot complete a Suspended run
    function testRevertCompleteSuspendedRun() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.suspendRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Running to complete");
        instance.completeRun(RUN_ID);
    }

    /// @notice Cannot cancel a Failed run
    function testRevertCancelFailedRun() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.failRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Pending or Running to cancel");
        instance.cancelRun(RUN_ID);
    }

    /// @notice Cannot cancel a Suspended run
    function testRevertCancelSuspendedRun() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.suspendRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Pending or Running to cancel");
        instance.cancelRun(RUN_ID);
    }

    /// @notice Cannot resume a Running run
    function testRevertResumeRunningRun() public {
        instance.startRun(RUN_ID, SPEC_REF);

        vm.expectRevert("ProcessRun: must be Suspended to resume");
        instance.resumeRun(RUN_ID);
    }

    /// @notice Cannot resume a Completed run
    function testRevertResumeCompletedRun() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.completeRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Suspended to resume");
        instance.resumeRun(RUN_ID);
    }

    // --- Parent-child hierarchies ---

    /// @notice Multiple children can be attached to a single parent
    function testMultipleChildrenOnParent() public {
        instance.startRun(RUN_ID, SPEC_REF);

        instance.startChild(CHILD_1, RUN_ID, SPEC_REF);
        instance.startChild(CHILD_2, RUN_ID, SPEC_REF_2);
        instance.startChild(CHILD_3, RUN_ID, SPEC_REF);

        bytes32[] memory children = instance.getChildRuns(RUN_ID);
        assertEq(children.length, 3);
        assertEq(children[0], CHILD_1);
        assertEq(children[1], CHILD_2);
        assertEq(children[2], CHILD_3);
    }

    /// @notice Child run with a non-existent parent reverts
    function testRevertChildWithNonexistentParent() public {
        vm.expectRevert("ProcessRun: parent run not found");
        instance.startChild(CHILD_1, keccak256("no-parent"), SPEC_REF);
    }

    /// @notice Child run with a Suspended parent reverts
    function testRevertChildWithSuspendedParent() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.suspendRun(RUN_ID);

        vm.expectRevert("ProcessRun: parent must be Running");
        instance.startChild(CHILD_1, RUN_ID, SPEC_REF);
    }

    /// @notice Child run with a Failed parent reverts
    function testRevertChildWithFailedParent() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.failRun(RUN_ID);

        vm.expectRevert("ProcessRun: parent must be Running");
        instance.startChild(CHILD_1, RUN_ID, SPEC_REF);
    }

    /// @notice Children have independent lifecycles from parent
    function testChildIndependentLifecycle() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.startChild(CHILD_1, RUN_ID, SPEC_REF);

        // Complete child while parent is still running
        instance.completeRun(CHILD_1);

        ProcessRun.RunView memory childView = instance.getStatus(CHILD_1);
        assertEq(uint8(childView.status), uint8(ProcessRun.Status.Completed));

        ProcessRun.RunView memory parentView = instance.getStatus(RUN_ID);
        assertEq(uint8(parentView.status), uint8(ProcessRun.Status.Running));
    }

    /// @notice Completing a parent does not affect child runs
    function testParentCompletionDoesNotAffectChildren() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.startChild(CHILD_1, RUN_ID, SPEC_REF);

        // Complete parent while child is still running
        instance.completeRun(RUN_ID);

        ProcessRun.RunView memory parentView = instance.getStatus(RUN_ID);
        assertEq(uint8(parentView.status), uint8(ProcessRun.Status.Completed));

        // Child still running
        ProcessRun.RunView memory childView = instance.getStatus(CHILD_1);
        assertEq(uint8(childView.status), uint8(ProcessRun.Status.Running));
    }

    // --- Event emissions ---

    /// @notice StartChild emits the correct event
    function testStartChildEmitsEvent() public {
        instance.startRun(RUN_ID, SPEC_REF);

        vm.expectEmit(true, true, false, false);
        emit ProcessRun.StartChildCompleted(CHILD_1, RUN_ID);

        instance.startChild(CHILD_1, RUN_ID, SPEC_REF);
    }

    /// @notice CompleteRun emits the correct event
    function testCompleteRunEmitsEvent() public {
        instance.startRun(RUN_ID, SPEC_REF);

        vm.expectEmit(true, false, false, false);
        emit ProcessRun.CompleteRunCompleted(RUN_ID);

        instance.completeRun(RUN_ID);
    }

    /// @notice FailRun emits the correct event
    function testFailRunEmitsEvent() public {
        instance.startRun(RUN_ID, SPEC_REF);

        vm.expectEmit(true, false, false, false);
        emit ProcessRun.FailRunCompleted(RUN_ID);

        instance.failRun(RUN_ID);
    }

    /// @notice CancelRun emits the correct event
    function testCancelRunEmitsEvent() public {
        instance.startRun(RUN_ID, SPEC_REF);

        vm.expectEmit(true, false, false, false);
        emit ProcessRun.CancelRunCompleted(RUN_ID);

        instance.cancelRun(RUN_ID);
    }

    /// @notice SuspendRun emits the correct event
    function testSuspendRunEmitsEvent() public {
        instance.startRun(RUN_ID, SPEC_REF);

        vm.expectEmit(true, false, false, false);
        emit ProcessRun.SuspendRunCompleted(RUN_ID);

        instance.suspendRun(RUN_ID);
    }

    /// @notice ResumeRun emits the correct event
    function testResumeRunEmitsEvent() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.suspendRun(RUN_ID);

        vm.expectEmit(true, false, false, false);
        emit ProcessRun.ResumeRunCompleted(RUN_ID);

        instance.resumeRun(RUN_ID);
    }

    // --- Data integrity ---

    /// @notice specRef is correctly stored and retrievable
    function testSpecRefIntegrity() public {
        instance.startRun(RUN_ID, SPEC_REF);
        instance.startRun(RUN_ID_2, SPEC_REF_2);

        ProcessRun.RunView memory v1 = instance.getStatus(RUN_ID);
        assertEq(v1.specRef, SPEC_REF);

        ProcessRun.RunView memory v2 = instance.getStatus(RUN_ID_2);
        assertEq(v2.specRef, SPEC_REF_2);
    }

    /// @notice getChildRuns returns empty array for run with no children
    function testGetChildRunsEmptyForRunWithNoChildren() public {
        instance.startRun(RUN_ID, SPEC_REF);

        bytes32[] memory children = instance.getChildRuns(RUN_ID);
        assertEq(children.length, 0);
    }

    /// @notice getChildRuns returns empty array for non-existent run
    function testGetChildRunsEmptyForNonexistentRun() public view {
        bytes32[] memory children = instance.getChildRuns(keccak256("none"));
        assertEq(children.length, 0);
    }
}
