// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Validator.sol";

contract ValidatorTest is Test {
    Validator public target;

    event ConstraintRegistered(bytes32 indexed constraintId);
    event RuleAdded(bytes32 indexed schemaId, bytes32 indexed fieldId);

    function setUp() public {
        target = new Validator();
    }

    // --- registerConstraint tests ---

    function test_registerConstraint_stores_constraint() public {
        bytes32 id = keccak256("required");
        target.registerConstraint(id, "required-evaluator");

        Validator.Constraint memory c = target.getConstraint(id);
        assertEq(c.evaluatorConfig, "required-evaluator", "Evaluator config should match");
        assertTrue(c.exists, "Constraint should exist");
    }

    function test_registerConstraint_emits_event() public {
        bytes32 id = keccak256("required");

        vm.expectEmit(true, false, false, false);
        emit ConstraintRegistered(id);

        target.registerConstraint(id, "config");
    }

    function test_registerConstraint_zero_id_reverts() public {
        vm.expectRevert("Constraint ID cannot be zero");
        target.registerConstraint(bytes32(0), "config");
    }

    function test_registerConstraint_empty_config_reverts() public {
        vm.expectRevert("Evaluator config cannot be empty");
        target.registerConstraint(keccak256("c1"), "");
    }

    // --- addRule tests ---

    function test_addRule_stores_rule() public {
        bytes32 constraintId = keccak256("required");
        bytes32 schemaId = keccak256("article");
        bytes32 fieldId = keccak256("title");

        target.registerConstraint(constraintId, "config");
        target.addRule(schemaId, fieldId, constraintId, "minLength:1");

        Validator.ValidationRule memory r = target.getRule(schemaId, fieldId);
        assertEq(r.constraintId, constraintId, "Constraint ID should match");
        assertEq(r.params, "minLength:1", "Params should match");
        assertTrue(r.exists);
    }

    function test_addRule_emits_event() public {
        bytes32 constraintId = keccak256("required");
        bytes32 schemaId = keccak256("article");
        bytes32 fieldId = keccak256("title");
        target.registerConstraint(constraintId, "config");

        vm.expectEmit(true, true, false, false);
        emit RuleAdded(schemaId, fieldId);

        target.addRule(schemaId, fieldId, constraintId, "params");
    }

    function test_addRule_zero_schema_reverts() public {
        bytes32 constraintId = keccak256("c1");
        target.registerConstraint(constraintId, "config");

        vm.expectRevert("Schema ID cannot be zero");
        target.addRule(bytes32(0), keccak256("f1"), constraintId, "");
    }

    function test_addRule_zero_field_reverts() public {
        bytes32 constraintId = keccak256("c1");
        target.registerConstraint(constraintId, "config");

        vm.expectRevert("Field ID cannot be zero");
        target.addRule(keccak256("s1"), bytes32(0), constraintId, "");
    }

    function test_addRule_nonexistent_constraint_reverts() public {
        vm.expectRevert("Constraint not found");
        target.addRule(keccak256("s1"), keccak256("f1"), keccak256("missing"), "");
    }

    // --- getConstraint tests ---

    function test_getConstraint_nonexistent_reverts() public {
        vm.expectRevert("Constraint not found");
        target.getConstraint(keccak256("missing"));
    }

    // --- getRule tests ---

    function test_getRule_nonexistent_reverts() public {
        vm.expectRevert("Rule not found");
        target.getRule(keccak256("s1"), keccak256("f1"));
    }

    // --- constraintExists tests ---

    function test_constraintExists_false_for_missing() public view {
        assertFalse(target.constraintExists(keccak256("missing")));
    }

    function test_constraintExists_true_after_register() public {
        bytes32 id = keccak256("c1");
        target.registerConstraint(id, "config");
        assertTrue(target.constraintExists(id));
    }
}
