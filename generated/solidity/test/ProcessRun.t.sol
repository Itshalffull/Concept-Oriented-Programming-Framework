// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessRun.sol";

/// @title ProcessRun Conformance Tests
/// @notice Tests for process run lifecycle and parent-child hierarchies
contract ProcessRunTest is Test {
    ProcessRun public target;

    bytes32 constant RUN_ID = keccak256("run-001");
    bytes32 constant CHILD_ID = keccak256("child-001");
    bytes32 constant SPEC_REF = keccak256("spec-001");

    function setUp() public {
        target = new ProcessRun();
    }

    /// @notice Starting a run sets status to Running
    function test_startRun_sets_running() public {
        target.startRun(RUN_ID, SPEC_REF);

        ProcessRun.RunView memory view = target.getStatus(RUN_ID);
        assertEq(uint8(view.status), uint8(ProcessRun.Status.Running));
        assertEq(view.specRef, SPEC_REF);
        assertEq(view.parentRunId, bytes32(0));
        assertGt(view.startedAt, 0);
    }

    /// @notice Duplicate run ID reverts
    function test_startRun_duplicate_reverts() public {
        target.startRun(RUN_ID, SPEC_REF);

        vm.expectRevert("ProcessRun: run already exists");
        target.startRun(RUN_ID, SPEC_REF);
    }

    /// @notice Starting a child run links to parent
    function test_startChild_links_parent() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.startChild(CHILD_ID, RUN_ID, SPEC_REF);

        ProcessRun.RunView memory childView = target.getStatus(CHILD_ID);
        assertEq(childView.parentRunId, RUN_ID);
        assertEq(uint8(childView.status), uint8(ProcessRun.Status.Running));

        bytes32[] memory children = target.getChildRuns(RUN_ID);
        assertEq(children.length, 1);
        assertEq(children[0], CHILD_ID);
    }

    /// @notice Starting a child on a non-running parent reverts
    function test_startChild_nonrunning_parent_reverts() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.completeRun(RUN_ID);

        vm.expectRevert("ProcessRun: parent must be Running");
        target.startChild(CHILD_ID, RUN_ID, SPEC_REF);
    }

    /// @notice Completing a running run sets Completed
    function test_completeRun() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.completeRun(RUN_ID);

        ProcessRun.RunView memory view = target.getStatus(RUN_ID);
        assertEq(uint8(view.status), uint8(ProcessRun.Status.Completed));
        assertGt(view.completedAt, 0);
    }

    /// @notice Completing a non-running run reverts
    function test_completeRun_not_running_reverts() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.completeRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Running to complete");
        target.completeRun(RUN_ID);
    }

    /// @notice Failing a running run sets Failed
    function test_failRun() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.failRun(RUN_ID);

        ProcessRun.RunView memory view = target.getStatus(RUN_ID);
        assertEq(uint8(view.status), uint8(ProcessRun.Status.Failed));
    }

    /// @notice Cancelling a running run sets Cancelled
    function test_cancelRun() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.cancelRun(RUN_ID);

        ProcessRun.RunView memory view = target.getStatus(RUN_ID);
        assertEq(uint8(view.status), uint8(ProcessRun.Status.Cancelled));
    }

    /// @notice Cancelling a completed run reverts
    function test_cancelRun_completed_reverts() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.completeRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Pending or Running to cancel");
        target.cancelRun(RUN_ID);
    }

    /// @notice Suspending and resuming a run
    function test_suspend_and_resume() public {
        target.startRun(RUN_ID, SPEC_REF);

        target.suspendRun(RUN_ID);
        ProcessRun.RunView memory suspended = target.getStatus(RUN_ID);
        assertEq(uint8(suspended.status), uint8(ProcessRun.Status.Suspended));

        target.resumeRun(RUN_ID);
        ProcessRun.RunView memory resumed = target.getStatus(RUN_ID);
        assertEq(uint8(resumed.status), uint8(ProcessRun.Status.Running));
    }

    /// @notice Suspending a non-running run reverts
    function test_suspendRun_not_running_reverts() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.suspendRun(RUN_ID);

        vm.expectRevert("ProcessRun: must be Running to suspend");
        target.suspendRun(RUN_ID);
    }

    /// @notice Resuming a non-suspended run reverts
    function test_resumeRun_not_suspended_reverts() public {
        target.startRun(RUN_ID, SPEC_REF);

        vm.expectRevert("ProcessRun: must be Suspended to resume");
        target.resumeRun(RUN_ID);
    }

    /// @notice Getting a non-existent run reverts
    function test_getStatus_nonexistent_reverts() public {
        vm.expectRevert("ProcessRun: not found");
        target.getStatus(keccak256("nonexistent"));
    }

    /// @notice StartRun emits event
    function test_startRun_emits_event() public {
        vm.expectEmit(true, true, false, false);
        emit ProcessRun.StartRunCompleted(RUN_ID, SPEC_REF);

        target.startRun(RUN_ID, SPEC_REF);
    }

    /// @notice Full lifecycle: start -> suspend -> resume -> complete
    function test_full_lifecycle() public {
        target.startRun(RUN_ID, SPEC_REF);
        target.suspendRun(RUN_ID);
        target.resumeRun(RUN_ID);
        target.completeRun(RUN_ID);

        ProcessRun.RunView memory view = target.getStatus(RUN_ID);
        assertEq(uint8(view.status), uint8(ProcessRun.Status.Completed));
    }
}
