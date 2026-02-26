// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Formula.sol";

contract FormulaTest is Test {
    Formula public target;

    event FormulaSet(bytes32 indexed formulaId);
    event FormulaEvaluated(bytes32 indexed formulaId);
    event FormulaInvalidated(bytes32 indexed formulaId);

    function setUp() public {
        target = new Formula();
    }

    // --- setExpression tests ---

    function test_setExpression_stores_formula() public {
        bytes32 fid = keccak256("f1");
        target.setExpression(fid, "A + B", "A,B");

        Formula.FormulaData memory f = target.getFormula(fid);
        assertEq(f.expression, "A + B");
        assertEq(f.dependencies, "A,B");
        assertEq(bytes(f.cachedResult).length, 0);
        assertEq(f.lastEvaluated, 0);
        assertTrue(f.exists);
    }

    function test_setExpression_emits_event() public {
        bytes32 fid = keccak256("f1");

        vm.expectEmit(true, false, false, false);
        emit FormulaSet(fid);

        target.setExpression(fid, "A + B", "A,B");
    }

    function test_setExpression_zero_id_reverts() public {
        vm.expectRevert("Formula ID cannot be zero");
        target.setExpression(bytes32(0), "A + B", "A");
    }

    function test_setExpression_empty_expression_reverts() public {
        vm.expectRevert("Expression cannot be empty");
        target.setExpression(keccak256("f1"), "", "A");
    }

    function test_setExpression_overwrites_existing() public {
        bytes32 fid = keccak256("f1");
        target.setExpression(fid, "A + B", "A,B");
        target.setExpression(fid, "C * D", "C,D");

        Formula.FormulaData memory f = target.getFormula(fid);
        assertEq(f.expression, "C * D");
        assertEq(f.dependencies, "C,D");
    }

    // --- cacheResult tests ---

    function test_cacheResult_stores_result() public {
        bytes32 fid = keccak256("f1");
        target.setExpression(fid, "A + B", "A,B");
        target.cacheResult(fid, "42");

        Formula.FormulaData memory f = target.getFormula(fid);
        assertEq(f.cachedResult, "42");
        assertGt(f.lastEvaluated, 0);
    }

    function test_cacheResult_emits_event() public {
        bytes32 fid = keccak256("f1");
        target.setExpression(fid, "A + B", "A,B");

        vm.expectEmit(true, false, false, false);
        emit FormulaEvaluated(fid);

        target.cacheResult(fid, "42");
    }

    function test_cacheResult_nonexistent_reverts() public {
        vm.expectRevert("Formula not found");
        target.cacheResult(keccak256("nonexistent"), "42");
    }

    // --- invalidate tests ---

    function test_invalidate_clears_cache() public {
        bytes32 fid = keccak256("f1");
        target.setExpression(fid, "A + B", "A,B");
        target.cacheResult(fid, "42");
        target.invalidate(fid);

        Formula.FormulaData memory f = target.getFormula(fid);
        assertEq(bytes(f.cachedResult).length, 0);
        assertEq(f.lastEvaluated, 0);
    }

    function test_invalidate_emits_event() public {
        bytes32 fid = keccak256("f1");
        target.setExpression(fid, "A + B", "A,B");

        vm.expectEmit(true, false, false, false);
        emit FormulaInvalidated(fid);

        target.invalidate(fid);
    }

    function test_invalidate_nonexistent_reverts() public {
        vm.expectRevert("Formula not found");
        target.invalidate(keccak256("nonexistent"));
    }

    // --- getFormula tests ---

    function test_getFormula_nonexistent_reverts() public {
        vm.expectRevert("Formula not found");
        target.getFormula(keccak256("nonexistent"));
    }

    // --- formulaExists tests ---

    function test_formulaExists_returns_true() public {
        bytes32 fid = keccak256("f1");
        target.setExpression(fid, "A + B", "A,B");

        assertTrue(target.formulaExists(fid));
    }

    function test_formulaExists_returns_false() public {
        assertFalse(target.formulaExists(keccak256("unknown")));
    }
}
