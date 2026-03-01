// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessSpec.sol";

/// @title ProcessSpec Business Logic Tests
/// @notice Tests for multi-step lifecycle, update integrity, graph structure, and edge cases
contract ProcessSpecBusinessTest is Test {
    ProcessSpec private instance;

    bytes32 constant SPEC_ID = keccak256("biz-spec-001");
    bytes32 constant SPEC_ID_2 = keccak256("biz-spec-002");
    bytes32 constant STEP_A = keccak256("step-a");
    bytes32 constant STEP_B = keccak256("step-b");
    bytes32 constant STEP_C = keccak256("step-c");
    bytes32 constant STEP_D = keccak256("step-d");

    function setUp() public {
        instance = new ProcessSpec();
    }

    // --- Helpers ---

    function _createSpec(bytes32 specId, string memory name, uint256 version) internal {
        bytes32[] memory stepIds = new bytes32[](2);
        stepIds[0] = STEP_A;
        stepIds[1] = STEP_B;

        string[] memory stepNames = new string[](2);
        stepNames[0] = "Start";
        stepNames[1] = "End";

        bytes32[] memory edgeFroms = new bytes32[](1);
        edgeFroms[0] = STEP_A;

        bytes32[] memory edgeTos = new bytes32[](1);
        edgeTos[0] = STEP_B;

        instance.create(ProcessSpec.CreateInput({
            specId: specId,
            name: name,
            version: version,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));
    }

    // --- Full lifecycle tests ---

    /// @notice Full lifecycle: Draft -> publish -> Active -> deprecate -> Deprecated
    function testFullLifecycleDraftToDeprecated() public {
        _createSpec(SPEC_ID, "Order Workflow", 1);

        // Verify Draft
        ProcessSpec.ProcessSpecView memory v1 = instance.get(SPEC_ID);
        assertEq(uint8(v1.status), uint8(ProcessSpec.Status.Draft));

        // Publish
        instance.publish(SPEC_ID);
        ProcessSpec.ProcessSpecView memory v2 = instance.get(SPEC_ID);
        assertEq(uint8(v2.status), uint8(ProcessSpec.Status.Active));

        // Deprecate
        instance.deprecate(SPEC_ID);
        ProcessSpec.ProcessSpecView memory v3 = instance.get(SPEC_ID);
        assertEq(uint8(v3.status), uint8(ProcessSpec.Status.Deprecated));

        // Name and version are preserved through transitions
        assertEq(v3.name, "Order Workflow");
        assertEq(v3.version, 1);
    }

    /// @notice Cannot deprecate a Draft spec (must go through Active first)
    function testRevertDeprecateDraftSpec() public {
        _createSpec(SPEC_ID, "Draft Spec", 1);

        vm.expectRevert("ProcessSpec: must be Active to deprecate");
        instance.deprecate(SPEC_ID);
    }

    /// @notice Cannot publish a Deprecated spec
    function testRevertPublishDeprecatedSpec() public {
        _createSpec(SPEC_ID, "Test", 1);
        instance.publish(SPEC_ID);
        instance.deprecate(SPEC_ID);

        vm.expectRevert("ProcessSpec: must be Draft to publish");
        instance.publish(SPEC_ID);
    }

    /// @notice Cannot update a Deprecated spec
    function testRevertUpdateDeprecatedSpec() public {
        _createSpec(SPEC_ID, "Test", 1);
        instance.publish(SPEC_ID);
        instance.deprecate(SPEC_ID);

        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);
        bytes32[] memory edgeFroms = new bytes32[](0);
        bytes32[] memory edgeTos = new bytes32[](0);

        vm.expectRevert("ProcessSpec: must be Draft to update");
        instance.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID,
            name: "Updated",
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));
    }

    // --- Update data integrity ---

    /// @notice Updating replaces all steps and edges; old steps are fully removed
    function testUpdateReplacesStepsCompletely() public {
        _createSpec(SPEC_ID, "Original", 1);

        // Update with entirely new steps
        bytes32[] memory newStepIds = new bytes32[](3);
        newStepIds[0] = STEP_B;
        newStepIds[1] = STEP_C;
        newStepIds[2] = STEP_D;

        string[] memory newStepNames = new string[](3);
        newStepNames[0] = "Validate";
        newStepNames[1] = "Process";
        newStepNames[2] = "Finalize";

        bytes32[] memory edgeFroms = new bytes32[](2);
        edgeFroms[0] = STEP_B;
        edgeFroms[1] = STEP_C;

        bytes32[] memory edgeTos = new bytes32[](2);
        edgeTos[0] = STEP_C;
        edgeTos[1] = STEP_D;

        instance.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID,
            name: "Revised",
            stepIds: newStepIds,
            stepNames: newStepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));

        ProcessSpec.ProcessSpecView memory v = instance.get(SPEC_ID);
        assertEq(v.name, "Revised");
        assertEq(v.stepCount, 3);
        assertEq(v.edgeCount, 2);

        // Verify new steps exist
        ProcessSpec.Step memory stepB = instance.getStep(SPEC_ID, STEP_B);
        assertEq(stepB.name, "Validate");

        ProcessSpec.Step memory stepC = instance.getStep(SPEC_ID, STEP_C);
        assertEq(stepC.name, "Process");

        // Verify old step A is removed
        vm.expectRevert("ProcessSpec: step not found");
        instance.getStep(SPEC_ID, STEP_A);
    }

    /// @notice Multiple updates to the same draft spec accumulate correctly
    function testMultipleUpdatesInDraft() public {
        _createSpec(SPEC_ID, "V1", 1);

        // First update: change name only, keep same structure
        bytes32[] memory stepIds = new bytes32[](1);
        stepIds[0] = STEP_A;
        string[] memory stepNames = new string[](1);
        stepNames[0] = "Only Step";
        bytes32[] memory ef = new bytes32[](0);
        bytes32[] memory et = new bytes32[](0);

        instance.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID,
            name: "V2",
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));

        ProcessSpec.ProcessSpecView memory v2 = instance.get(SPEC_ID);
        assertEq(v2.name, "V2");
        assertEq(v2.stepCount, 1);
        assertEq(v2.edgeCount, 0);

        // Second update: add more complexity
        bytes32[] memory stepIds2 = new bytes32[](4);
        stepIds2[0] = STEP_A;
        stepIds2[1] = STEP_B;
        stepIds2[2] = STEP_C;
        stepIds2[3] = STEP_D;
        string[] memory stepNames2 = new string[](4);
        stepNames2[0] = "Init";
        stepNames2[1] = "Validate";
        stepNames2[2] = "Execute";
        stepNames2[3] = "Close";
        bytes32[] memory ef2 = new bytes32[](3);
        ef2[0] = STEP_A;
        ef2[1] = STEP_B;
        ef2[2] = STEP_C;
        bytes32[] memory et2 = new bytes32[](3);
        et2[0] = STEP_B;
        et2[1] = STEP_C;
        et2[2] = STEP_D;

        instance.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID,
            name: "V3 Final",
            stepIds: stepIds2,
            stepNames: stepNames2,
            edgeFroms: ef2,
            edgeTos: et2
        }));

        ProcessSpec.ProcessSpecView memory v3 = instance.get(SPEC_ID);
        assertEq(v3.name, "V3 Final");
        assertEq(v3.stepCount, 4);
        assertEq(v3.edgeCount, 3);
        // Version is immutable from create
        assertEq(v3.version, 1);
    }

    // --- Validation edge cases ---

    /// @notice Creating with mismatched step arrays reverts
    function testRevertStepArrayMismatch() public {
        bytes32[] memory stepIds = new bytes32[](2);
        stepIds[0] = STEP_A;
        stepIds[1] = STEP_B;

        string[] memory stepNames = new string[](1);
        stepNames[0] = "Only One";

        bytes32[] memory ef = new bytes32[](0);
        bytes32[] memory et = new bytes32[](0);

        vm.expectRevert("ProcessSpec: step arrays mismatch");
        instance.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Bad",
            version: 1,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));
    }

    /// @notice Creating with mismatched edge arrays reverts
    function testRevertEdgeArrayMismatch() public {
        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);

        bytes32[] memory ef = new bytes32[](2);
        ef[0] = STEP_A;
        ef[1] = STEP_B;
        bytes32[] memory et = new bytes32[](1);
        et[0] = STEP_B;

        vm.expectRevert("ProcessSpec: edge arrays mismatch");
        instance.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Bad Edges",
            version: 1,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));
    }

    /// @notice Creating with empty name reverts
    function testRevertCreateEmptyName() public {
        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);
        bytes32[] memory ef = new bytes32[](0);
        bytes32[] memory et = new bytes32[](0);

        vm.expectRevert("ProcessSpec: name required");
        instance.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "",
            version: 1,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));
    }

    // --- Event emission ---

    /// @notice Publish emits PublishCompleted event
    function testPublishEmitsEvent() public {
        _createSpec(SPEC_ID, "Evt Test", 1);

        vm.expectEmit(true, false, false, false);
        emit ProcessSpec.PublishCompleted(SPEC_ID);

        instance.publish(SPEC_ID);
    }

    /// @notice Deprecate emits DeprecateCompleted event
    function testDeprecateEmitsEvent() public {
        _createSpec(SPEC_ID, "Evt Test", 1);
        instance.publish(SPEC_ID);

        vm.expectEmit(true, false, false, false);
        emit ProcessSpec.DeprecateCompleted(SPEC_ID);

        instance.deprecate(SPEC_ID);
    }

    /// @notice Update emits UpdateCompleted event
    function testUpdateEmitsEvent() public {
        _createSpec(SPEC_ID, "Original", 1);

        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);
        bytes32[] memory ef = new bytes32[](0);
        bytes32[] memory et = new bytes32[](0);

        vm.expectEmit(true, false, false, true);
        emit ProcessSpec.UpdateCompleted(SPEC_ID, "New Name");

        instance.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID,
            name: "New Name",
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));
    }

    // --- Multiple independent specs ---

    /// @notice Multiple specs can coexist with independent lifecycles
    function testMultipleIndependentSpecs() public {
        _createSpec(SPEC_ID, "Spec A", 1);
        _createSpec(SPEC_ID_2, "Spec B", 2);

        // Publish only Spec A
        instance.publish(SPEC_ID);

        ProcessSpec.ProcessSpecView memory vA = instance.get(SPEC_ID);
        assertEq(uint8(vA.status), uint8(ProcessSpec.Status.Active));

        ProcessSpec.ProcessSpecView memory vB = instance.get(SPEC_ID_2);
        assertEq(uint8(vB.status), uint8(ProcessSpec.Status.Draft));

        // Deprecate Spec A while Spec B is still Draft
        instance.deprecate(SPEC_ID);
        ProcessSpec.ProcessSpecView memory vA2 = instance.get(SPEC_ID);
        assertEq(uint8(vA2.status), uint8(ProcessSpec.Status.Deprecated));

        // Spec B can still be updated and published
        bytes32[] memory stepIds = new bytes32[](1);
        stepIds[0] = STEP_C;
        string[] memory stepNames = new string[](1);
        stepNames[0] = "Solo";
        bytes32[] memory ef = new bytes32[](0);
        bytes32[] memory et = new bytes32[](0);

        instance.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID_2,
            name: "Spec B Updated",
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));

        instance.publish(SPEC_ID_2);
        ProcessSpec.ProcessSpecView memory vB2 = instance.get(SPEC_ID_2);
        assertEq(uint8(vB2.status), uint8(ProcessSpec.Status.Active));
        assertEq(vB2.name, "Spec B Updated");
    }

    // --- Edge graph structure ---

    /// @notice Spec with no steps and no edges is valid
    function testCreateMinimalSpec() public {
        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);
        bytes32[] memory ef = new bytes32[](0);
        bytes32[] memory et = new bytes32[](0);

        instance.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Minimal",
            version: 0,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));

        ProcessSpec.ProcessSpecView memory v = instance.get(SPEC_ID);
        assertEq(v.stepCount, 0);
        assertEq(v.edgeCount, 0);
        assertEq(v.version, 0);
    }

    /// @notice Retrieving step IDs preserves order
    function testStepIdOrderPreserved() public {
        bytes32[] memory stepIds = new bytes32[](4);
        stepIds[0] = STEP_D;
        stepIds[1] = STEP_C;
        stepIds[2] = STEP_A;
        stepIds[3] = STEP_B;

        string[] memory stepNames = new string[](4);
        stepNames[0] = "D";
        stepNames[1] = "C";
        stepNames[2] = "A";
        stepNames[3] = "B";

        bytes32[] memory ef = new bytes32[](0);
        bytes32[] memory et = new bytes32[](0);

        instance.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Order Test",
            version: 1,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));

        bytes32[] memory retrieved = instance.getStepIds(SPEC_ID);
        assertEq(retrieved.length, 4);
        assertEq(retrieved[0], STEP_D);
        assertEq(retrieved[1], STEP_C);
        assertEq(retrieved[2], STEP_A);
        assertEq(retrieved[3], STEP_B);
    }

    /// @notice Edges preserve from/to relationships
    function testEdgeRelationshipIntegrity() public {
        bytes32[] memory stepIds = new bytes32[](3);
        stepIds[0] = STEP_A;
        stepIds[1] = STEP_B;
        stepIds[2] = STEP_C;

        string[] memory stepNames = new string[](3);
        stepNames[0] = "A";
        stepNames[1] = "B";
        stepNames[2] = "C";

        // A->B, B->C, A->C (diamond pattern)
        bytes32[] memory ef = new bytes32[](3);
        ef[0] = STEP_A;
        ef[1] = STEP_B;
        ef[2] = STEP_A;

        bytes32[] memory et = new bytes32[](3);
        et[0] = STEP_B;
        et[1] = STEP_C;
        et[2] = STEP_C;

        instance.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Diamond",
            version: 1,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: ef,
            edgeTos: et
        }));

        ProcessSpec.Edge[] memory edges = instance.getEdges(SPEC_ID);
        assertEq(edges.length, 3);
        assertEq(edges[0].from, STEP_A);
        assertEq(edges[0].to, STEP_B);
        assertEq(edges[1].from, STEP_B);
        assertEq(edges[1].to, STEP_C);
        assertEq(edges[2].from, STEP_A);
        assertEq(edges[2].to, STEP_C);
    }
}
