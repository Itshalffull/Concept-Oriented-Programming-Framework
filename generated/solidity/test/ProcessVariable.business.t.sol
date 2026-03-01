// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessVariable.sol";

/// @title ProcessVariable Business Logic Tests
/// @notice Tests for variable scoping, merge chains, delete/re-create cycles, and listing integrity
contract ProcessVariableBusinessTest is Test {
    ProcessVariable private instance;

    bytes32 constant RUN_A = keccak256("biz-run-a");
    bytes32 constant RUN_B = keccak256("biz-run-b");
    bytes32 constant RUN_C = keccak256("biz-run-c");

    function setUp() public {
        instance = new ProcessVariable();
    }

    // --- Multi-merge chain ---

    /// @notice Chaining multiple merges builds up a log string
    function testMultipleMergeChain() public {
        instance.setVar(RUN_A, "auditLog", "init;");
        instance.mergeVar(RUN_A, "auditLog", "step1;");
        instance.mergeVar(RUN_A, "auditLog", "step2;");
        instance.mergeVar(RUN_A, "auditLog", "step3;");
        instance.mergeVar(RUN_A, "auditLog", "complete;");

        string memory result = instance.getVar(RUN_A, "auditLog");
        assertEq(result, "init;step1;step2;step3;complete;");
    }

    /// @notice Merge with empty string is a no-op on value
    function testMergeEmptyString() public {
        instance.setVar(RUN_A, "data", "original");
        instance.mergeVar(RUN_A, "data", "");

        string memory result = instance.getVar(RUN_A, "data");
        assertEq(result, "original");
    }

    /// @notice Merge into empty-string variable produces the append value
    function testMergeIntoEmptyValue() public {
        instance.setVar(RUN_A, "buf", "");
        instance.mergeVar(RUN_A, "buf", "added");

        string memory result = instance.getVar(RUN_A, "buf");
        assertEq(result, "added");
    }

    // --- Delete and re-create cycles ---

    /// @notice Delete then set recreates the variable with correct value
    function testDeleteAndRecreate() public {
        instance.setVar(RUN_A, "token", "abc");
        instance.deleteVar(RUN_A, "token");

        // Cannot get deleted var
        vm.expectRevert("ProcessVariable: variable not found");
        instance.getVar(RUN_A, "token");

        // Re-create
        instance.setVar(RUN_A, "token", "xyz");
        assertEq(instance.getVar(RUN_A, "token"), "xyz");
    }

    /// @notice Deleted variable cannot be merged
    function testRevertMergeDeletedVariable() public {
        instance.setVar(RUN_A, "temp", "val");
        instance.deleteVar(RUN_A, "temp");

        vm.expectRevert("ProcessVariable: variable not found for merge");
        instance.mergeVar(RUN_A, "temp", "more");
    }

    /// @notice Double delete reverts
    function testRevertDoubleDelete() public {
        instance.setVar(RUN_A, "once", "val");
        instance.deleteVar(RUN_A, "once");

        vm.expectRevert("ProcessVariable: variable not found");
        instance.deleteVar(RUN_A, "once");
    }

    // --- Cross-run scoping ---

    /// @notice Same variable name in different runs are fully independent
    function testCrossRunIsolation() public {
        instance.setVar(RUN_A, "status", "pending");
        instance.setVar(RUN_B, "status", "active");
        instance.setVar(RUN_C, "status", "completed");

        assertEq(instance.getVar(RUN_A, "status"), "pending");
        assertEq(instance.getVar(RUN_B, "status"), "active");
        assertEq(instance.getVar(RUN_C, "status"), "completed");

        // Deleting in one run does not affect others
        instance.deleteVar(RUN_B, "status");

        assertEq(instance.getVar(RUN_A, "status"), "pending");
        assertEq(instance.getVar(RUN_C, "status"), "completed");

        vm.expectRevert("ProcessVariable: variable not found");
        instance.getVar(RUN_B, "status");
    }

    // --- listVars integrity ---

    /// @notice listVars reflects correct state after multiple set/delete operations
    function testListVarsAfterMixedOperations() public {
        instance.setVar(RUN_A, "alpha", "1");
        instance.setVar(RUN_A, "beta", "2");
        instance.setVar(RUN_A, "gamma", "3");
        instance.setVar(RUN_A, "delta", "4");

        instance.deleteVar(RUN_A, "beta");
        instance.deleteVar(RUN_A, "delta");

        ProcessVariable.VarEntry[] memory entries = instance.listVars(RUN_A);
        assertEq(entries.length, 2);
        assertEq(entries[0].name, "alpha");
        assertEq(entries[0].value, "1");
        assertEq(entries[1].name, "gamma");
        assertEq(entries[1].value, "3");
    }

    /// @notice listVars includes re-created variables after delete+set
    function testListVarsWithRecreatedVariable() public {
        instance.setVar(RUN_A, "x", "first");
        instance.deleteVar(RUN_A, "x");
        instance.setVar(RUN_A, "x", "second");

        ProcessVariable.VarEntry[] memory entries = instance.listVars(RUN_A);
        assertEq(entries.length, 1);
        assertEq(entries[0].name, "x");
        assertEq(entries[0].value, "second");
    }

    /// @notice listVars is scoped to the correct run
    function testListVarsScopedPerRun() public {
        instance.setVar(RUN_A, "a", "1");
        instance.setVar(RUN_A, "b", "2");
        instance.setVar(RUN_B, "c", "3");

        ProcessVariable.VarEntry[] memory entriesA = instance.listVars(RUN_A);
        assertEq(entriesA.length, 2);

        ProcessVariable.VarEntry[] memory entriesB = instance.listVars(RUN_B);
        assertEq(entriesB.length, 1);
        assertEq(entriesB[0].name, "c");
    }

    // --- Event emission ---

    /// @notice mergeVar emits MergeVarCompleted with the concatenated value
    function testMergeVarEmitsEvent() public {
        instance.setVar(RUN_A, "log", "A;");

        vm.expectEmit(true, false, false, true);
        emit ProcessVariable.MergeVarCompleted(RUN_A, "log", "A;B;");

        instance.mergeVar(RUN_A, "log", "B;");
    }

    /// @notice deleteVar emits DeleteVarCompleted event
    function testDeleteVarEmitsEvent() public {
        instance.setVar(RUN_A, "key", "val");

        vm.expectEmit(true, false, false, true);
        emit ProcessVariable.DeleteVarCompleted(RUN_A, "key");

        instance.deleteVar(RUN_A, "key");
    }

    // --- Overwrite semantics ---

    /// @notice Overwriting a variable updates listVars correctly (no duplicates)
    function testOverwriteDoesNotDuplicateInList() public {
        instance.setVar(RUN_A, "counter", "1");
        instance.setVar(RUN_A, "counter", "2");
        instance.setVar(RUN_A, "counter", "3");

        ProcessVariable.VarEntry[] memory entries = instance.listVars(RUN_A);
        assertEq(entries.length, 1);
        assertEq(entries[0].value, "3");
    }

    /// @notice Setting a variable with an empty value is valid
    function testSetEmptyValue() public {
        instance.setVar(RUN_A, "empty", "");
        assertEq(instance.getVar(RUN_A, "empty"), "");

        ProcessVariable.VarEntry[] memory entries = instance.listVars(RUN_A);
        assertEq(entries.length, 1);
        assertEq(entries[0].value, "");
    }
}
