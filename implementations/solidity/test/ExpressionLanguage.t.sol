// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ExpressionLanguage.sol";

contract ExpressionLanguageTest is Test {
    ExpressionLanguage public target;

    event LanguageRegistered(bytes32 indexed languageId);
    event FunctionRegistered(bytes32 indexed languageId, string name);

    function setUp() public {
        target = new ExpressionLanguage();
    }

    // --- registerLanguage tests ---

    function test_registerLanguage_stores_language() public {
        bytes32 lid = keccak256("math");
        target.registerLanguage(lid, "expr := term (('+' | '-') term)*");

        ExpressionLanguage.Language memory lang = target.getLanguage(lid);
        assertEq(lang.grammar, "expr := term (('+' | '-') term)*");
        assertTrue(lang.exists);
    }

    function test_registerLanguage_emits_event() public {
        bytes32 lid = keccak256("math");

        vm.expectEmit(true, false, false, false);
        emit LanguageRegistered(lid);

        target.registerLanguage(lid, "grammar");
    }

    function test_registerLanguage_zero_id_reverts() public {
        vm.expectRevert("Language ID cannot be zero");
        target.registerLanguage(bytes32(0), "grammar");
    }

    function test_registerLanguage_empty_grammar_reverts() public {
        vm.expectRevert("Grammar cannot be empty");
        target.registerLanguage(keccak256("math"), "");
    }

    // --- registerFunction tests ---

    function test_registerFunction_stores_function() public {
        bytes32 lid = keccak256("math");
        bytes32 fnh = keccak256("sum");
        target.registerLanguage(lid, "grammar");
        target.registerFunction(lid, fnh, "sum", "sum(a: number, b: number) -> number");

        ExpressionLanguage.FunctionDef memory fd = target.getFunction(lid, fnh);
        assertEq(fd.signature, "sum(a: number, b: number) -> number");
        assertTrue(fd.exists);
    }

    function test_registerFunction_emits_event() public {
        bytes32 lid = keccak256("math");
        target.registerLanguage(lid, "grammar");

        vm.expectEmit(true, false, false, true);
        emit FunctionRegistered(lid, "sum");

        target.registerFunction(lid, keccak256("sum"), "sum", "sum(a,b)->number");
    }

    function test_registerFunction_language_not_found_reverts() public {
        vm.expectRevert("Language not found");
        target.registerFunction(keccak256("none"), keccak256("fn"), "fn", "sig");
    }

    function test_registerFunction_zero_hash_reverts() public {
        bytes32 lid = keccak256("math");
        target.registerLanguage(lid, "grammar");

        vm.expectRevert("Function name hash cannot be zero");
        target.registerFunction(lid, bytes32(0), "fn", "sig");
    }

    function test_registerFunction_empty_signature_reverts() public {
        bytes32 lid = keccak256("math");
        target.registerLanguage(lid, "grammar");

        vm.expectRevert("Signature cannot be empty");
        target.registerFunction(lid, keccak256("fn"), "fn", "");
    }

    // --- getLanguage tests ---

    function test_getLanguage_nonexistent_reverts() public {
        vm.expectRevert("Language not found");
        target.getLanguage(keccak256("none"));
    }

    // --- getFunction tests ---

    function test_getFunction_nonexistent_reverts() public {
        bytes32 lid = keccak256("math");
        target.registerLanguage(lid, "grammar");

        vm.expectRevert("Function not found");
        target.getFunction(lid, keccak256("nonexistent"));
    }

    // --- languageExists tests ---

    function test_languageExists_returns_true() public {
        bytes32 lid = keccak256("math");
        target.registerLanguage(lid, "grammar");

        assertTrue(target.languageExists(lid));
    }

    function test_languageExists_returns_false() public {
        assertFalse(target.languageExists(keccak256("unknown")));
    }
}
