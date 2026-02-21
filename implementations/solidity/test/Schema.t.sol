// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Schema.sol";

contract SchemaTest is Test {
    Schema public target;

    event SchemaDefined(bytes32 indexed schemaId, string name);
    event FieldAdded(bytes32 indexed schemaId);
    event SchemaExtended(bytes32 indexed childId, bytes32 indexed parentId);
    event SchemaApplied(bytes32 indexed nodeId, bytes32 indexed schemaId);
    event SchemaRemoved(bytes32 indexed nodeId);

    function setUp() public {
        target = new Schema();
    }

    // --- defineSchema tests ---

    function test_defineSchema_stores_schema() public {
        bytes32 schemaId = keccak256("article");
        target.defineSchema(schemaId, "Article", "title:string,body:text");

        Schema.SchemaData memory s = target.getSchema(schemaId);
        assertEq(s.name, "Article", "Name should match");
        assertEq(s.fields, "title:string,body:text", "Fields should match");
        assertEq(s.parentId, bytes32(0), "Parent should be zero initially");
        assertTrue(s.exists);
    }

    function test_defineSchema_emits_event() public {
        bytes32 schemaId = keccak256("article");

        vm.expectEmit(true, false, false, true);
        emit SchemaDefined(schemaId, "Article");

        target.defineSchema(schemaId, "Article", "fields");
    }

    function test_defineSchema_duplicate_reverts() public {
        bytes32 schemaId = keccak256("article");
        target.defineSchema(schemaId, "Article", "fields");

        vm.expectRevert("Schema already exists");
        target.defineSchema(schemaId, "Article2", "fields2");
    }

    function test_defineSchema_empty_name_reverts() public {
        vm.expectRevert("Name cannot be empty");
        target.defineSchema(keccak256("s1"), "", "fields");
    }

    // --- addField tests ---

    function test_addField_appends_to_fields() public {
        bytes32 schemaId = keccak256("article");
        target.defineSchema(schemaId, "Article", "title:string");
        target.addField(schemaId, "body:text");

        Schema.SchemaData memory s = target.getSchema(schemaId);
        assertEq(s.fields, "title:string,body:text", "Field should be appended");
    }

    function test_addField_nonexistent_reverts() public {
        vm.expectRevert("Schema does not exist");
        target.addField(keccak256("missing"), "field:type");
    }

    // --- extendSchema tests ---

    function test_extendSchema_sets_parent() public {
        bytes32 parentId = keccak256("content");
        bytes32 childId = keccak256("article");
        target.defineSchema(parentId, "Content", "title:string");
        target.defineSchema(childId, "Article", "body:text");
        target.extendSchema(childId, parentId);

        Schema.SchemaData memory s = target.getSchema(childId);
        assertEq(s.parentId, parentId, "Parent should be set");
    }

    function test_extendSchema_nonexistent_child_reverts() public {
        bytes32 parentId = keccak256("content");
        target.defineSchema(parentId, "Content", "fields");

        vm.expectRevert("Child schema does not exist");
        target.extendSchema(keccak256("missing"), parentId);
    }

    function test_extendSchema_nonexistent_parent_reverts() public {
        bytes32 childId = keccak256("article");
        target.defineSchema(childId, "Article", "fields");

        vm.expectRevert("Parent schema does not exist");
        target.extendSchema(childId, keccak256("missing"));
    }

    function test_extendSchema_self_reverts() public {
        bytes32 schemaId = keccak256("article");
        target.defineSchema(schemaId, "Article", "fields");

        vm.expectRevert("Schema cannot extend itself");
        target.extendSchema(schemaId, schemaId);
    }

    // --- applyTo tests ---

    function test_applyTo_assigns_schema_to_node() public {
        bytes32 schemaId = keccak256("article");
        bytes32 nodeId = keccak256("node1");
        target.defineSchema(schemaId, "Article", "fields");
        target.applyTo(nodeId, schemaId);

        (bool hasSchema, bytes32 assigned) = target.getNodeSchema(nodeId);
        assertTrue(hasSchema, "Node should have a schema");
        assertEq(assigned, schemaId, "Assigned schema should match");
    }

    function test_applyTo_nonexistent_schema_reverts() public {
        vm.expectRevert("Schema does not exist");
        target.applyTo(keccak256("n1"), keccak256("missing"));
    }

    function test_applyTo_zero_node_reverts() public {
        bytes32 schemaId = keccak256("article");
        target.defineSchema(schemaId, "Article", "fields");

        vm.expectRevert("Invalid node ID");
        target.applyTo(bytes32(0), schemaId);
    }

    // --- removeFrom tests ---

    function test_removeFrom_clears_assignment() public {
        bytes32 schemaId = keccak256("article");
        bytes32 nodeId = keccak256("node1");
        target.defineSchema(schemaId, "Article", "fields");
        target.applyTo(nodeId, schemaId);

        target.removeFrom(nodeId);

        (bool hasSchema,) = target.getNodeSchema(nodeId);
        assertFalse(hasSchema, "Node should have no schema after removal");
    }

    function test_removeFrom_no_schema_reverts() public {
        vm.expectRevert("Node has no schema");
        target.removeFrom(keccak256("unassigned"));
    }

    // --- getSchema tests ---

    function test_getSchema_nonexistent_reverts() public {
        vm.expectRevert("Schema does not exist");
        target.getSchema(keccak256("missing"));
    }

    // --- getNodeSchema tests ---

    function test_getNodeSchema_false_for_unassigned() public view {
        (bool hasSchema,) = target.getNodeSchema(keccak256("unassigned"));
        assertFalse(hasSchema);
    }
}
