// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FlowToken.sol";

/// @title FlowToken Conformance Tests
/// @notice Tests for flow token emission, consumption, and lifecycle
contract FlowTokenTest is Test {
    FlowToken public target;

    bytes32 constant TOKEN_ID = keccak256("token-001");
    bytes32 constant TOKEN_ID_2 = keccak256("token-002");
    bytes32 constant TOKEN_ID_3 = keccak256("token-003");
    bytes32 constant RUN_REF = keccak256("run-001");
    bytes32 constant STEP_REF = keccak256("step-a");

    function setUp() public {
        target = new FlowToken();
    }

    /// @notice Emitting a token sets it to Active
    function test_emit_creates_active_token() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);

        FlowToken.TokenView memory view = target.getToken(TOKEN_ID);
        assertEq(uint8(view.status), uint8(FlowToken.Status.Active));
        assertEq(view.runRef, RUN_REF);
        assertEq(view.currentStepRef, STEP_REF);
        assertGt(view.createdAt, 0);
        assertEq(view.resolvedAt, 0);
    }

    /// @notice Duplicate token ID reverts
    function test_emit_duplicate_reverts() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);

        vm.expectRevert("FlowToken: token already exists");
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
    }

    /// @notice Consuming an active token sets Consumed
    function test_consume_active_token() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
        target.consume(TOKEN_ID);

        FlowToken.TokenView memory view = target.getToken(TOKEN_ID);
        assertEq(uint8(view.status), uint8(FlowToken.Status.Consumed));
        assertGt(view.resolvedAt, 0);
    }

    /// @notice Consuming a non-active token reverts
    function test_consume_dead_reverts() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
        target.kill(TOKEN_ID);

        vm.expectRevert("FlowToken: must be Active to consume");
        target.consume(TOKEN_ID);
    }

    /// @notice Killing an active token sets Dead
    function test_kill_active_token() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
        target.kill(TOKEN_ID);

        FlowToken.TokenView memory view = target.getToken(TOKEN_ID);
        assertEq(uint8(view.status), uint8(FlowToken.Status.Dead));
        assertGt(view.resolvedAt, 0);
    }

    /// @notice Killing a consumed token reverts
    function test_kill_consumed_reverts() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
        target.consume(TOKEN_ID);

        vm.expectRevert("FlowToken: must be Active to kill");
        target.kill(TOKEN_ID);
    }

    /// @notice countActive returns correct count
    function test_countActive() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
        target.emit_(TOKEN_ID_2, RUN_REF, STEP_REF);
        target.emit_(TOKEN_ID_3, RUN_REF, STEP_REF);

        assertEq(target.countActive(RUN_REF), 3);

        target.consume(TOKEN_ID);
        assertEq(target.countActive(RUN_REF), 2);

        target.kill(TOKEN_ID_2);
        assertEq(target.countActive(RUN_REF), 1);
    }

    /// @notice listActive returns only active tokens
    function test_listActive() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
        target.emit_(TOKEN_ID_2, RUN_REF, STEP_REF);
        target.emit_(TOKEN_ID_3, RUN_REF, STEP_REF);

        target.consume(TOKEN_ID);

        bytes32[] memory active = target.listActive(RUN_REF);
        assertEq(active.length, 2);
        assertEq(active[0], TOKEN_ID_2);
        assertEq(active[1], TOKEN_ID_3);
    }

    /// @notice countActive returns zero for run with no tokens
    function test_countActive_empty() public view {
        assertEq(target.countActive(keccak256("empty-run")), 0);
    }

    /// @notice listActive returns empty array for run with no active tokens
    function test_listActive_all_consumed() public {
        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
        target.consume(TOKEN_ID);

        bytes32[] memory active = target.listActive(RUN_REF);
        assertEq(active.length, 0);
    }

    /// @notice Getting a non-existent token reverts
    function test_getToken_nonexistent_reverts() public {
        vm.expectRevert("FlowToken: not found");
        target.getToken(keccak256("nonexistent"));
    }

    /// @notice Emit emits event
    function test_emit_emits_event() public {
        vm.expectEmit(true, true, true, false);
        emit FlowToken.EmitCompleted(TOKEN_ID, RUN_REF, STEP_REF);

        target.emit_(TOKEN_ID, RUN_REF, STEP_REF);
    }
}
