// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/StepRun.sol";

/// @title StepRun Business Logic Tests
/// @notice Tests for step execution lifecycle, multi-step runs, skip behavior, and data integrity
contract StepRunBusinessTest is Test {
    StepRun private instance;

    bytes32 constant STEP_RUN_1 = keccak256("biz-step-001");
    bytes32 constant STEP_RUN_2 = keccak256("biz-step-002");
    bytes32 constant STEP_RUN_3 = keccak256("biz-step-003");
    bytes32 constant STEP_RUN_4 = keccak256("biz-step-004");
    bytes32 constant RUN_REF = keccak256("run-001");
    bytes32 constant RUN_REF_2 = keccak256("run-002");
    bytes32 constant STEP_A = keccak256("step-a");
    bytes32 constant STEP_B = keccak256("step-b");
    bytes32 constant STEP_C = keccak256("step-c");

    function setUp() public {
        instance = new StepRun();
    }

    // --- Full lifecycle with multiple steps in a run ---

    /// @notice Simulate a three-step sequential process: start, complete each in order
    function testThreeStepSequentialExecution() public {
        vm.warp(100);
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);

        vm.warp(200);
        instance.completeStep(STEP_RUN_1, "Step A done");

        vm.warp(300);
        instance.startStep(STEP_RUN_2, RUN_REF, STEP_B);

        vm.warp(400);
        instance.completeStep(STEP_RUN_2, "Step B done");

        vm.warp(500);
        instance.startStep(STEP_RUN_3, RUN_REF, STEP_C);

        vm.warp(600);
        instance.completeStep(STEP_RUN_3, "Step C done");

        // Verify all steps
        bytes32[] memory steps = instance.getStepsByRun(RUN_REF);
        assertEq(steps.length, 3);

        StepRun.StepRunView memory v1 = instance.getStep(STEP_RUN_1);
        assertEq(uint8(v1.status), uint8(StepRun.Status.Completed));
        assertEq(v1.startedAt, 100);
        assertEq(v1.completedAt, 200);
        assertEq(v1.resultData, "Step A done");

        StepRun.StepRunView memory v3 = instance.getStep(STEP_RUN_3);
        assertEq(uint8(v3.status), uint8(StepRun.Status.Completed));
        assertEq(v3.startedAt, 500);
        assertEq(v3.completedAt, 600);
    }

    /// @notice Process with a mix of completed, failed, and skipped steps
    function testMixedStepOutcomes() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);
        instance.completeStep(STEP_RUN_1, "ok");

        instance.startStep(STEP_RUN_2, RUN_REF, STEP_B);
        instance.failStep(STEP_RUN_2, "error: validation failed");

        // Skip step C entirely (never started)
        instance.skipStep(STEP_RUN_3, RUN_REF, STEP_C);

        StepRun.StepRunView memory v1 = instance.getStep(STEP_RUN_1);
        assertEq(uint8(v1.status), uint8(StepRun.Status.Completed));

        StepRun.StepRunView memory v2 = instance.getStep(STEP_RUN_2);
        assertEq(uint8(v2.status), uint8(StepRun.Status.Failed));
        assertEq(v2.resultData, "error: validation failed");

        StepRun.StepRunView memory v3 = instance.getStep(STEP_RUN_3);
        assertEq(uint8(v3.status), uint8(StepRun.Status.Skipped));
        assertEq(v3.startedAt, 0);
        assertGt(v3.completedAt, 0);

        bytes32[] memory steps = instance.getStepsByRun(RUN_REF);
        assertEq(steps.length, 3);
    }

    // --- Invalid state transitions ---

    /// @notice Cannot fail a completed step
    function testRevertFailCompletedStep() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);
        instance.completeStep(STEP_RUN_1, "done");

        vm.expectRevert("StepRun: must be Active to fail");
        instance.failStep(STEP_RUN_1, "too late");
    }

    /// @notice Cannot fail a cancelled step
    function testRevertFailCancelledStep() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);
        instance.cancelStep(STEP_RUN_1);

        vm.expectRevert("StepRun: must be Active to fail");
        instance.failStep(STEP_RUN_1, "too late");
    }

    /// @notice Cannot fail a skipped step
    function testRevertFailSkippedStep() public {
        instance.skipStep(STEP_RUN_1, RUN_REF, STEP_A);

        vm.expectRevert("StepRun: must be Active to fail");
        instance.failStep(STEP_RUN_1, "too late");
    }

    /// @notice Cannot cancel a failed step
    function testRevertCancelFailedStep() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);
        instance.failStep(STEP_RUN_1, "error");

        vm.expectRevert("StepRun: must be Pending or Active to cancel");
        instance.cancelStep(STEP_RUN_1);
    }

    /// @notice Cannot cancel a skipped step
    function testRevertCancelSkippedStep() public {
        instance.skipStep(STEP_RUN_1, RUN_REF, STEP_A);

        vm.expectRevert("StepRun: must be Pending or Active to cancel");
        instance.cancelStep(STEP_RUN_1);
    }

    /// @notice Cannot skip a completed step (non-Pending existing step)
    function testRevertSkipCompletedStep() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);
        instance.completeStep(STEP_RUN_1, "done");

        vm.expectRevert("StepRun: must be Pending to skip");
        instance.skipStep(STEP_RUN_1, RUN_REF, STEP_A);
    }

    // --- Timestamp integrity ---

    /// @notice Timestamps reflect actual block.timestamp at each state change
    function testTimestampIntegrity() public {
        vm.warp(1000);
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);

        StepRun.StepRunView memory v1 = instance.getStep(STEP_RUN_1);
        assertEq(v1.startedAt, 1000);
        assertEq(v1.completedAt, 0);

        vm.warp(5000);
        instance.completeStep(STEP_RUN_1, "result");

        StepRun.StepRunView memory v2 = instance.getStep(STEP_RUN_1);
        assertEq(v2.startedAt, 1000);
        assertEq(v2.completedAt, 5000);
    }

    /// @notice Cancel sets completedAt but fail does too
    function testCancelTimestamp() public {
        vm.warp(1000);
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);

        vm.warp(2000);
        instance.cancelStep(STEP_RUN_1);

        StepRun.StepRunView memory v = instance.getStep(STEP_RUN_1);
        assertEq(v.completedAt, 2000);
    }

    // --- Event emission ---

    /// @notice CompleteStep emits event
    function testCompleteStepEmitsEvent() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);

        vm.expectEmit(true, false, false, false);
        emit StepRun.CompleteStepCompleted(STEP_RUN_1);

        instance.completeStep(STEP_RUN_1, "done");
    }

    /// @notice FailStep emits event
    function testFailStepEmitsEvent() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);

        vm.expectEmit(true, false, false, false);
        emit StepRun.FailStepCompleted(STEP_RUN_1);

        instance.failStep(STEP_RUN_1, "error");
    }

    /// @notice CancelStep emits event
    function testCancelStepEmitsEvent() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);

        vm.expectEmit(true, false, false, false);
        emit StepRun.CancelStepCompleted(STEP_RUN_1);

        instance.cancelStep(STEP_RUN_1);
    }

    /// @notice SkipStep emits event
    function testSkipStepEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit StepRun.SkipStepCompleted(STEP_RUN_1);

        instance.skipStep(STEP_RUN_1, RUN_REF, STEP_A);
    }

    // --- Cross-run isolation ---

    /// @notice Steps from different runs are isolated
    function testCrossRunIsolation() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);
        instance.startStep(STEP_RUN_2, RUN_REF_2, STEP_A);

        instance.completeStep(STEP_RUN_1, "run1 result");
        instance.failStep(STEP_RUN_2, "run2 error");

        bytes32[] memory run1Steps = instance.getStepsByRun(RUN_REF);
        assertEq(run1Steps.length, 1);
        assertEq(run1Steps[0], STEP_RUN_1);

        bytes32[] memory run2Steps = instance.getStepsByRun(RUN_REF_2);
        assertEq(run2Steps.length, 1);
        assertEq(run2Steps[0], STEP_RUN_2);

        StepRun.StepRunView memory v1 = instance.getStep(STEP_RUN_1);
        assertEq(uint8(v1.status), uint8(StepRun.Status.Completed));

        StepRun.StepRunView memory v2 = instance.getStep(STEP_RUN_2);
        assertEq(uint8(v2.status), uint8(StepRun.Status.Failed));
    }

    /// @notice Empty result data is valid for completeStep
    function testEmptyResultData() public {
        instance.startStep(STEP_RUN_1, RUN_REF, STEP_A);
        instance.completeStep(STEP_RUN_1, "");

        StepRun.StepRunView memory v = instance.getStep(STEP_RUN_1);
        assertEq(v.resultData, "");
        assertEq(uint8(v.status), uint8(StepRun.Status.Completed));
    }

    /// @notice getStepsByRun returns empty for nonexistent run
    function testGetStepsByRunEmpty() public view {
        bytes32[] memory steps = instance.getStepsByRun(keccak256("no-run"));
        assertEq(steps.length, 0);
    }
}
