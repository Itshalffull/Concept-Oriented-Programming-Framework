// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Milestone.sol";

/// @title Milestone Business Logic Tests
/// @notice Tests for evaluation logic, re-evaluation, revocation, conditions, and edge cases
contract MilestoneBusinessTest is Test {
    Milestone private instance;

    bytes32 constant MS_1 = keccak256("biz-ms-001");
    bytes32 constant MS_2 = keccak256("biz-ms-002");
    bytes32 constant MS_3 = keccak256("biz-ms-003");
    bytes32 constant RUN_A = keccak256("biz-run-a");
    bytes32 constant RUN_B = keccak256("biz-run-b");
    bytes32 constant TARGET_STEP = keccak256("step-payment");
    bytes32 constant TARGET_VAR = keccak256("var-amount");
    bytes32 constant TARGET_CUSTOM = keccak256("custom-check");

    function setUp() public {
        instance = new Milestone();
    }

    // --- Helpers ---

    function _defineWithConditions(
        bytes32 msId,
        bytes32 runRef,
        string memory name,
        uint8[] memory condTypes,
        bytes32[] memory targetRefs,
        string[] memory expectedValues
    ) internal {
        instance.define(msId, runRef, name, "", condTypes, targetRefs, expectedValues);
    }

    function _defineThreeConditionMilestone() internal {
        uint8[] memory condTypes = new uint8[](3);
        condTypes[0] = uint8(Milestone.ConditionType.StepCompleted);
        condTypes[1] = uint8(Milestone.ConditionType.VariableEquals);
        condTypes[2] = uint8(Milestone.ConditionType.ThresholdMet);

        bytes32[] memory targetRefs = new bytes32[](3);
        targetRefs[0] = TARGET_STEP;
        targetRefs[1] = TARGET_VAR;
        targetRefs[2] = TARGET_CUSTOM;

        string[] memory expectedValues = new string[](3);
        expectedValues[0] = "completed";
        expectedValues[1] = "500";
        expectedValues[2] = "100";

        _defineWithConditions(MS_1, RUN_A, "Payment Complete", condTypes, targetRefs, expectedValues);
    }

    // --- Full evaluation lifecycle ---

    /// @notice Define -> evaluate (fail) -> re-evaluate (fail) -> re-evaluate (pass)
    function testMultipleReEvaluationAttempts() public {
        _defineThreeConditionMilestone();

        // Attempt 1: none met
        bool[] memory attempt1 = new bool[](3);
        attempt1[0] = false;
        attempt1[1] = false;
        attempt1[2] = false;
        instance.evaluate(MS_1, attempt1);

        Milestone.MilestoneView memory v1 = instance.getMilestone(MS_1);
        assertEq(uint8(v1.status), uint8(Milestone.Status.NotReached));

        // Attempt 2: partial met
        bool[] memory attempt2 = new bool[](3);
        attempt2[0] = true;
        attempt2[1] = true;
        attempt2[2] = false;
        instance.evaluate(MS_1, attempt2);

        Milestone.MilestoneView memory v2 = instance.getMilestone(MS_1);
        assertEq(uint8(v2.status), uint8(Milestone.Status.NotReached));

        // Attempt 3: all met
        bool[] memory attempt3 = new bool[](3);
        attempt3[0] = true;
        attempt3[1] = true;
        attempt3[2] = true;
        instance.evaluate(MS_1, attempt3);

        Milestone.MilestoneView memory v3 = instance.getMilestone(MS_1);
        assertEq(uint8(v3.status), uint8(Milestone.Status.Reached));
    }

    /// @notice Once Reached, cannot re-evaluate (status is terminal for evaluation)
    function testRevertReEvaluateReachedMilestone() public {
        _defineThreeConditionMilestone();

        bool[] memory results = new bool[](3);
        results[0] = true;
        results[1] = true;
        results[2] = true;
        instance.evaluate(MS_1, results);

        vm.expectRevert("Milestone: cannot evaluate in current status");
        instance.evaluate(MS_1, results);
    }

    /// @notice Evaluate a Revoked milestone reverts
    function testRevertEvaluateRevokedMilestone() public {
        _defineThreeConditionMilestone();
        instance.revoke(MS_1);

        bool[] memory results = new bool[](3);
        results[0] = true;
        results[1] = true;
        results[2] = true;

        vm.expectRevert("Milestone: cannot evaluate in current status");
        instance.evaluate(MS_1, results);
    }

    // --- Revocation from different states ---

    /// @notice Revoke from Defined state
    function testRevokeFromDefined() public {
        _defineThreeConditionMilestone();

        instance.revoke(MS_1);

        Milestone.MilestoneView memory v = instance.getMilestone(MS_1);
        assertEq(uint8(v.status), uint8(Milestone.Status.Revoked));
        assertGt(v.evaluatedAt, 0);
    }

    /// @notice Revoke from NotReached state
    function testRevokeFromNotReached() public {
        _defineThreeConditionMilestone();

        bool[] memory results = new bool[](3);
        results[0] = false;
        results[1] = false;
        results[2] = false;
        instance.evaluate(MS_1, results);

        instance.revoke(MS_1);

        Milestone.MilestoneView memory v = instance.getMilestone(MS_1);
        assertEq(uint8(v.status), uint8(Milestone.Status.Revoked));
    }

    /// @notice Revoke from Reached state (previously tested in conformance, but verify evaluatedAt update)
    function testRevokeFromReachedUpdatesTimestamp() public {
        _defineThreeConditionMilestone();

        vm.warp(1000);
        bool[] memory results = new bool[](3);
        results[0] = true;
        results[1] = true;
        results[2] = true;
        instance.evaluate(MS_1, results);

        Milestone.MilestoneView memory vReached = instance.getMilestone(MS_1);
        assertEq(vReached.evaluatedAt, 1000);

        vm.warp(2000);
        instance.revoke(MS_1);

        Milestone.MilestoneView memory vRevoked = instance.getMilestone(MS_1);
        assertEq(vRevoked.evaluatedAt, 2000);
    }

    // --- Condition types ---

    /// @notice Milestone with all four condition types
    function testAllConditionTypes() public {
        uint8[] memory condTypes = new uint8[](4);
        condTypes[0] = uint8(Milestone.ConditionType.StepCompleted);
        condTypes[1] = uint8(Milestone.ConditionType.VariableEquals);
        condTypes[2] = uint8(Milestone.ConditionType.ThresholdMet);
        condTypes[3] = uint8(Milestone.ConditionType.Custom);

        bytes32[] memory targetRefs = new bytes32[](4);
        targetRefs[0] = keccak256("step-1");
        targetRefs[1] = keccak256("var-1");
        targetRefs[2] = keccak256("threshold-1");
        targetRefs[3] = keccak256("custom-1");

        string[] memory expectedValues = new string[](4);
        expectedValues[0] = "done";
        expectedValues[1] = "expected-value";
        expectedValues[2] = "100";
        expectedValues[3] = "custom-check-passed";

        _defineWithConditions(MS_1, RUN_A, "Complex Milestone", condTypes, targetRefs, expectedValues);

        Milestone.Condition[] memory conditions = instance.getConditions(MS_1);
        assertEq(conditions.length, 4);
        assertEq(uint8(conditions[0].condType), uint8(Milestone.ConditionType.StepCompleted));
        assertEq(uint8(conditions[1].condType), uint8(Milestone.ConditionType.VariableEquals));
        assertEq(uint8(conditions[2].condType), uint8(Milestone.ConditionType.ThresholdMet));
        assertEq(uint8(conditions[3].condType), uint8(Milestone.ConditionType.Custom));
    }

    /// @notice Mismatched condition arrays (condTypes vs targetRefs) reverts
    function testRevertConditionArrayMismatchTargetRefs() public {
        uint8[] memory condTypes = new uint8[](2);
        condTypes[0] = 0;
        condTypes[1] = 1;

        bytes32[] memory targetRefs = new bytes32[](1);
        targetRefs[0] = TARGET_STEP;

        string[] memory expectedValues = new string[](2);
        expectedValues[0] = "a";
        expectedValues[1] = "b";

        vm.expectRevert("Milestone: condition arrays mismatch");
        instance.define(MS_1, RUN_A, "Bad", "", condTypes, targetRefs, expectedValues);
    }

    /// @notice Mismatched condition arrays (condTypes vs expectedValues) reverts
    function testRevertConditionArrayMismatchExpectedValues() public {
        uint8[] memory condTypes = new uint8[](2);
        condTypes[0] = 0;
        condTypes[1] = 1;

        bytes32[] memory targetRefs = new bytes32[](2);
        targetRefs[0] = TARGET_STEP;
        targetRefs[1] = TARGET_VAR;

        string[] memory expectedValues = new string[](1);
        expectedValues[0] = "a";

        vm.expectRevert("Milestone: condition arrays mismatch");
        instance.define(MS_1, RUN_A, "Bad", "", condTypes, targetRefs, expectedValues);
    }

    // --- Timestamp integrity ---

    /// @notice definedAt is set at define time, evaluatedAt updates on each evaluation
    function testTimestampIntegrity() public {
        vm.warp(100);
        _defineThreeConditionMilestone();

        Milestone.MilestoneView memory v0 = instance.getMilestone(MS_1);
        assertEq(v0.definedAt, 100);
        assertEq(v0.evaluatedAt, 0);

        vm.warp(200);
        bool[] memory partial = new bool[](3);
        partial[0] = true;
        partial[1] = false;
        partial[2] = false;
        instance.evaluate(MS_1, partial);

        Milestone.MilestoneView memory v1 = instance.getMilestone(MS_1);
        assertEq(v1.definedAt, 100);
        assertEq(v1.evaluatedAt, 200);

        vm.warp(300);
        bool[] memory full = new bool[](3);
        full[0] = true;
        full[1] = true;
        full[2] = true;
        instance.evaluate(MS_1, full);

        Milestone.MilestoneView memory v2 = instance.getMilestone(MS_1);
        assertEq(v2.definedAt, 100);
        assertEq(v2.evaluatedAt, 300);
    }

    // --- Multiple milestones per run ---

    /// @notice Multiple milestones on the same run have independent states
    function testMultipleMilestonesPerRun() public {
        uint8[] memory condTypes = new uint8[](1);
        condTypes[0] = uint8(Milestone.ConditionType.StepCompleted);
        bytes32[] memory targetRefs = new bytes32[](1);
        targetRefs[0] = TARGET_STEP;
        string[] memory expectedValues = new string[](1);
        expectedValues[0] = "done";

        _defineWithConditions(MS_1, RUN_A, "MS 1", condTypes, targetRefs, expectedValues);
        _defineWithConditions(MS_2, RUN_A, "MS 2", condTypes, targetRefs, expectedValues);
        _defineWithConditions(MS_3, RUN_A, "MS 3", condTypes, targetRefs, expectedValues);

        // Reach MS 1, leave others
        bool[] memory results = new bool[](1);
        results[0] = true;
        instance.evaluate(MS_1, results);

        // Revoke MS 3
        instance.revoke(MS_3);

        Milestone.MilestoneView memory v1 = instance.getMilestone(MS_1);
        assertEq(uint8(v1.status), uint8(Milestone.Status.Reached));

        Milestone.MilestoneView memory v2 = instance.getMilestone(MS_2);
        assertEq(uint8(v2.status), uint8(Milestone.Status.Defined));

        Milestone.MilestoneView memory v3 = instance.getMilestone(MS_3);
        assertEq(uint8(v3.status), uint8(Milestone.Status.Revoked));

        bytes32[] memory runMs = instance.getMilestonesByRun(RUN_A);
        assertEq(runMs.length, 3);
    }

    // --- Event emission ---

    /// @notice Evaluate emits EvaluateCompleted with correct status
    function testEvaluateEmitsEventReached() public {
        _defineThreeConditionMilestone();

        bool[] memory results = new bool[](3);
        results[0] = true;
        results[1] = true;
        results[2] = true;

        vm.expectEmit(true, false, false, true);
        emit Milestone.EvaluateCompleted(MS_1, Milestone.Status.Reached);

        instance.evaluate(MS_1, results);
    }

    /// @notice Evaluate emits EvaluateCompleted with NotReached status
    function testEvaluateEmitsEventNotReached() public {
        _defineThreeConditionMilestone();

        bool[] memory results = new bool[](3);
        results[0] = true;
        results[1] = false;
        results[2] = true;

        vm.expectEmit(true, false, false, true);
        emit Milestone.EvaluateCompleted(MS_1, Milestone.Status.NotReached);

        instance.evaluate(MS_1, results);
    }

    /// @notice Revoke emits RevokeCompleted event
    function testRevokeEmitsEvent() public {
        _defineThreeConditionMilestone();

        vm.expectEmit(true, false, false, false);
        emit Milestone.RevokeCompleted(MS_1);

        instance.revoke(MS_1);
    }

    // --- Cross-run isolation ---

    /// @notice Milestones from different runs are isolated
    function testCrossRunIsolation() public {
        uint8[] memory condTypes = new uint8[](0);
        bytes32[] memory targetRefs = new bytes32[](0);
        string[] memory expectedValues = new string[](0);

        _defineWithConditions(MS_1, RUN_A, "Run A MS", condTypes, targetRefs, expectedValues);
        _defineWithConditions(MS_2, RUN_B, "Run B MS", condTypes, targetRefs, expectedValues);

        bytes32[] memory runAMs = instance.getMilestonesByRun(RUN_A);
        assertEq(runAMs.length, 1);
        assertEq(runAMs[0], MS_1);

        bytes32[] memory runBMs = instance.getMilestonesByRun(RUN_B);
        assertEq(runBMs.length, 1);
        assertEq(runBMs[0], MS_2);
    }

    /// @notice getMilestonesByRun returns empty for run with no milestones
    function testGetMilestonesByRunEmpty() public view {
        bytes32[] memory result = instance.getMilestonesByRun(keccak256("empty-run"));
        assertEq(result.length, 0);
    }

    /// @notice getConditions for non-existent milestone reverts
    function testRevertGetConditionsNonexistent() public {
        vm.expectRevert("Milestone: not found");
        instance.getConditions(keccak256("ghost"));
    }
}
