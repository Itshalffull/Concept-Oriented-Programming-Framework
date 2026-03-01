// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/StepRun.sol";

/// @title StepRun Conformance Tests
/// @notice Tests for step execution lifecycle within process runs
contract StepRunTest is Test {
    StepRun public target;

    bytes32 constant STEP_RUN_ID = keccak256("step-run-001");
    bytes32 constant RUN_REF = keccak256("run-001");
    bytes32 constant STEP_REF = keccak256("step-a");

    function setUp() public {
        target = new StepRun();
    }

    /// @notice Starting a step sets it to Active
    function test_startStep_sets_active() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);

        StepRun.StepRunView memory view = target.getStep(STEP_RUN_ID);
        assertEq(uint8(view.status), uint8(StepRun.Status.Active));
        assertEq(view.runRef, RUN_REF);
        assertEq(view.stepRef, STEP_REF);
        assertGt(view.startedAt, 0);
    }

    /// @notice Duplicate step run ID reverts
    function test_startStep_duplicate_reverts() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);

        vm.expectRevert("StepRun: already exists");
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
    }

    /// @notice Completing an active step sets Completed with result data
    function test_completeStep() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
        target.completeStep(STEP_RUN_ID, "output: success");

        StepRun.StepRunView memory view = target.getStep(STEP_RUN_ID);
        assertEq(uint8(view.status), uint8(StepRun.Status.Completed));
        assertEq(view.resultData, "output: success");
        assertGt(view.completedAt, 0);
    }

    /// @notice Completing a non-active step reverts
    function test_completeStep_not_active_reverts() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
        target.completeStep(STEP_RUN_ID, "done");

        vm.expectRevert("StepRun: must be Active to complete");
        target.completeStep(STEP_RUN_ID, "again");
    }

    /// @notice Failing an active step sets Failed
    function test_failStep() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
        target.failStep(STEP_RUN_ID, "error: timeout");

        StepRun.StepRunView memory view = target.getStep(STEP_RUN_ID);
        assertEq(uint8(view.status), uint8(StepRun.Status.Failed));
        assertEq(view.resultData, "error: timeout");
    }

    /// @notice Cancelling an active step sets Cancelled
    function test_cancelStep_active() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
        target.cancelStep(STEP_RUN_ID);

        StepRun.StepRunView memory view = target.getStep(STEP_RUN_ID);
        assertEq(uint8(view.status), uint8(StepRun.Status.Cancelled));
    }

    /// @notice Cancelling a completed step reverts
    function test_cancelStep_completed_reverts() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
        target.completeStep(STEP_RUN_ID, "done");

        vm.expectRevert("StepRun: must be Pending or Active to cancel");
        target.cancelStep(STEP_RUN_ID);
    }

    /// @notice Skipping a step that doesn't exist yet creates it as Skipped
    function test_skipStep_new() public {
        target.skipStep(STEP_RUN_ID, RUN_REF, STEP_REF);

        StepRun.StepRunView memory view = target.getStep(STEP_RUN_ID);
        assertEq(uint8(view.status), uint8(StepRun.Status.Skipped));
        assertEq(view.startedAt, 0);
        assertGt(view.completedAt, 0);
    }

    /// @notice Skipping an active step reverts (must be Pending)
    function test_skipStep_active_reverts() public {
        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);

        vm.expectRevert("StepRun: must be Pending to skip");
        target.skipStep(STEP_RUN_ID, RUN_REF, STEP_REF);
    }

    /// @notice Getting a non-existent step reverts
    function test_getStep_nonexistent_reverts() public {
        vm.expectRevert("StepRun: not found");
        target.getStep(keccak256("nonexistent"));
    }

    /// @notice Steps are tracked by run reference
    function test_getStepsByRun() public {
        bytes32 stepRun2 = keccak256("step-run-002");

        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
        target.startStep(stepRun2, RUN_REF, keccak256("step-b"));

        bytes32[] memory steps = target.getStepsByRun(RUN_REF);
        assertEq(steps.length, 2);
        assertEq(steps[0], STEP_RUN_ID);
        assertEq(steps[1], stepRun2);
    }

    /// @notice StartStep emits event
    function test_startStep_emits_event() public {
        vm.expectEmit(true, true, true, false);
        emit StepRun.StartStepCompleted(STEP_RUN_ID, RUN_REF, STEP_REF);

        target.startStep(STEP_RUN_ID, RUN_REF, STEP_REF);
    }
}
