// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FlowToken.sol";

/// @title FlowToken Business Logic Tests
/// @notice Tests for token lifecycle, multi-token runs, cross-run isolation, and edge cases
contract FlowTokenBusinessTest is Test {
    FlowToken private instance;

    bytes32 constant TOKEN_1 = keccak256("biz-token-001");
    bytes32 constant TOKEN_2 = keccak256("biz-token-002");
    bytes32 constant TOKEN_3 = keccak256("biz-token-003");
    bytes32 constant TOKEN_4 = keccak256("biz-token-004");
    bytes32 constant TOKEN_5 = keccak256("biz-token-005");
    bytes32 constant RUN_A = keccak256("run-a");
    bytes32 constant RUN_B = keccak256("run-b");
    bytes32 constant STEP_1 = keccak256("step-1");
    bytes32 constant STEP_2 = keccak256("step-2");
    bytes32 constant STEP_3 = keccak256("step-3");

    function setUp() public {
        instance = new FlowToken();
    }

    // --- Multi-token lifecycle in a run ---

    /// @notice Simulate parallel token flow: emit multiple, consume some, kill others
    function testParallelTokenFlow() public {
        // Emit three tokens for parallel execution
        instance.emit_(TOKEN_1, RUN_A, STEP_1);
        instance.emit_(TOKEN_2, RUN_A, STEP_2);
        instance.emit_(TOKEN_3, RUN_A, STEP_3);

        assertEq(instance.countActive(RUN_A), 3);

        // One branch completes (consume), one errors (kill), one still active
        instance.consume(TOKEN_1);
        instance.kill(TOKEN_2);

        assertEq(instance.countActive(RUN_A), 1);

        bytes32[] memory active = instance.listActive(RUN_A);
        assertEq(active.length, 1);
        assertEq(active[0], TOKEN_3);

        // Final token completes
        instance.consume(TOKEN_3);
        assertEq(instance.countActive(RUN_A), 0);

        bytes32[] memory activeAfter = instance.listActive(RUN_A);
        assertEq(activeAfter.length, 0);
    }

    /// @notice All tokens killed simulates a full process cancellation
    function testKillAllTokensSimulatesCancel() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);
        instance.emit_(TOKEN_2, RUN_A, STEP_2);
        instance.emit_(TOKEN_3, RUN_A, STEP_3);

        instance.kill(TOKEN_1);
        instance.kill(TOKEN_2);
        instance.kill(TOKEN_3);

        assertEq(instance.countActive(RUN_A), 0);

        // Verify each token is Dead
        FlowToken.TokenView memory v1 = instance.getToken(TOKEN_1);
        assertEq(uint8(v1.status), uint8(FlowToken.Status.Dead));

        FlowToken.TokenView memory v2 = instance.getToken(TOKEN_2);
        assertEq(uint8(v2.status), uint8(FlowToken.Status.Dead));

        FlowToken.TokenView memory v3 = instance.getToken(TOKEN_3);
        assertEq(uint8(v3.status), uint8(FlowToken.Status.Dead));
    }

    // --- Invalid transitions ---

    /// @notice Cannot consume a consumed token (double consume)
    function testRevertDoubleConsume() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);
        instance.consume(TOKEN_1);

        vm.expectRevert("FlowToken: must be Active to consume");
        instance.consume(TOKEN_1);
    }

    /// @notice Cannot kill a killed token (double kill)
    function testRevertDoubleKill() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);
        instance.kill(TOKEN_1);

        vm.expectRevert("FlowToken: must be Active to kill");
        instance.kill(TOKEN_1);
    }

    /// @notice Cannot consume a non-existent token
    function testRevertConsumeNonexistent() public {
        vm.expectRevert("FlowToken: not found");
        instance.consume(keccak256("ghost"));
    }

    /// @notice Cannot kill a non-existent token
    function testRevertKillNonexistent() public {
        vm.expectRevert("FlowToken: not found");
        instance.kill(keccak256("ghost"));
    }

    // --- Timestamp integrity ---

    /// @notice Timestamps are set correctly on emit, consume, and kill
    function testTimestampIntegrity() public {
        vm.warp(1000);
        instance.emit_(TOKEN_1, RUN_A, STEP_1);

        FlowToken.TokenView memory v1 = instance.getToken(TOKEN_1);
        assertEq(v1.createdAt, 1000);
        assertEq(v1.resolvedAt, 0);

        vm.warp(2000);
        instance.consume(TOKEN_1);

        FlowToken.TokenView memory v2 = instance.getToken(TOKEN_1);
        assertEq(v2.createdAt, 1000);
        assertEq(v2.resolvedAt, 2000);
    }

    /// @notice Kill sets resolvedAt correctly
    function testKillTimestamp() public {
        vm.warp(500);
        instance.emit_(TOKEN_1, RUN_A, STEP_1);

        vm.warp(750);
        instance.kill(TOKEN_1);

        FlowToken.TokenView memory v = instance.getToken(TOKEN_1);
        assertEq(v.createdAt, 500);
        assertEq(v.resolvedAt, 750);
    }

    // --- Cross-run isolation ---

    /// @notice Tokens from different runs do not interfere with each other
    function testCrossRunIsolation() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);
        instance.emit_(TOKEN_2, RUN_A, STEP_2);
        instance.emit_(TOKEN_3, RUN_B, STEP_1);

        assertEq(instance.countActive(RUN_A), 2);
        assertEq(instance.countActive(RUN_B), 1);

        instance.consume(TOKEN_1);
        assertEq(instance.countActive(RUN_A), 1);
        assertEq(instance.countActive(RUN_B), 1);

        instance.kill(TOKEN_3);
        assertEq(instance.countActive(RUN_A), 1);
        assertEq(instance.countActive(RUN_B), 0);
    }

    // --- Event emission ---

    /// @notice Consume emits ConsumeCompleted event
    function testConsumeEmitsEvent() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);

        vm.expectEmit(true, false, false, false);
        emit FlowToken.ConsumeCompleted(TOKEN_1);

        instance.consume(TOKEN_1);
    }

    /// @notice Kill emits KillCompleted event
    function testKillEmitsEvent() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);

        vm.expectEmit(true, false, false, false);
        emit FlowToken.KillCompleted(TOKEN_1);

        instance.kill(TOKEN_1);
    }

    // --- Data integrity ---

    /// @notice Token stores runRef and currentStepRef correctly
    function testTokenDataFields() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);
        instance.emit_(TOKEN_2, RUN_B, STEP_2);

        FlowToken.TokenView memory v1 = instance.getToken(TOKEN_1);
        assertEq(v1.tokenId, TOKEN_1);
        assertEq(v1.runRef, RUN_A);
        assertEq(v1.currentStepRef, STEP_1);

        FlowToken.TokenView memory v2 = instance.getToken(TOKEN_2);
        assertEq(v2.tokenId, TOKEN_2);
        assertEq(v2.runRef, RUN_B);
        assertEq(v2.currentStepRef, STEP_2);
    }

    /// @notice listActive returns correct tokens after mixed operations
    function testListActiveAfterMixedOperations() public {
        instance.emit_(TOKEN_1, RUN_A, STEP_1);
        instance.emit_(TOKEN_2, RUN_A, STEP_2);
        instance.emit_(TOKEN_3, RUN_A, STEP_3);
        instance.emit_(TOKEN_4, RUN_A, STEP_1);
        instance.emit_(TOKEN_5, RUN_A, STEP_2);

        // Consume 1 and 3, kill 5
        instance.consume(TOKEN_1);
        instance.consume(TOKEN_3);
        instance.kill(TOKEN_5);

        bytes32[] memory active = instance.listActive(RUN_A);
        assertEq(active.length, 2);
        assertEq(active[0], TOKEN_2);
        assertEq(active[1], TOKEN_4);
    }

    /// @notice countActive and listActive are consistent for empty run
    function testCountAndListActiveConsistentEmpty() public view {
        bytes32 emptyRun = keccak256("empty");
        assertEq(instance.countActive(emptyRun), 0);
        bytes32[] memory active = instance.listActive(emptyRun);
        assertEq(active.length, 0);
    }
}
