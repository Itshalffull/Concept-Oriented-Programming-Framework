// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PageAsRecord.sol";

contract PageAsRecordTest is Test {
    PageAsRecord public target;

    event PropertySet(bytes32 indexed nodeId, string name);
    event BodyAppended(bytes32 indexed nodeId, bytes32 childNodeId);
    event SchemaAttached(bytes32 indexed nodeId, bytes32 schemaId);
    event SchemaDetached(bytes32 indexed nodeId);

    function setUp() public {
        target = new PageAsRecord();
    }

    // --- create tests ---

    function test_create_makes_page() public {
        bytes32 id = keccak256("page1");
        target.create(id);

        (bool hasSchema, bytes32 schemaId) = target.getSchema(id);
        assertFalse(hasSchema);
        assertEq(schemaId, bytes32(0));
    }

    function test_create_zero_id_reverts() public {
        vm.expectRevert("Node ID cannot be zero");
        target.create(bytes32(0));
    }

    function test_create_duplicate_reverts() public {
        bytes32 id = keccak256("page1");
        target.create(id);

        vm.expectRevert("Page already exists");
        target.create(id);
    }

    // --- setProperty / getProperty tests ---

    function test_setProperty_stores_and_retrieves() public {
        bytes32 id = keccak256("page1");
        target.create(id);
        target.setProperty(id, "title", "My Page");

        string memory val = target.getProperty(id, "title");
        assertEq(val, "My Page");
    }

    function test_setProperty_emits_event() public {
        bytes32 id = keccak256("page1");
        target.create(id);

        vm.expectEmit(true, false, false, true);
        emit PropertySet(id, "title");

        target.setProperty(id, "title", "My Page");
    }

    function test_setProperty_nonexistent_page_reverts() public {
        vm.expectRevert("Page not found");
        target.setProperty(keccak256("missing"), "title", "val");
    }

    function test_getProperty_nonexistent_page_reverts() public {
        vm.expectRevert("Page not found");
        target.getProperty(keccak256("missing"), "title");
    }

    // --- appendToBody tests ---

    function test_appendToBody_adds_children() public {
        bytes32 id = keccak256("page1");
        bytes32 child1 = keccak256("child1");
        bytes32 child2 = keccak256("child2");

        target.create(id);
        target.appendToBody(id, child1);
        target.appendToBody(id, child2);

        bytes32[] memory body = target.getBody(id);
        assertEq(body.length, 2);
        assertEq(body[0], child1);
        assertEq(body[1], child2);
    }

    function test_appendToBody_emits_event() public {
        bytes32 id = keccak256("page1");
        bytes32 child = keccak256("child1");

        target.create(id);

        vm.expectEmit(true, false, false, true);
        emit BodyAppended(id, child);

        target.appendToBody(id, child);
    }

    function test_appendToBody_nonexistent_page_reverts() public {
        vm.expectRevert("Page not found");
        target.appendToBody(keccak256("missing"), keccak256("child"));
    }

    function test_appendToBody_zero_child_reverts() public {
        bytes32 id = keccak256("page1");
        target.create(id);

        vm.expectRevert("Child node ID cannot be zero");
        target.appendToBody(id, bytes32(0));
    }

    // --- attachToSchema / detachFromSchema tests ---

    function test_attachToSchema_binds_schema() public {
        bytes32 id = keccak256("page1");
        bytes32 schema = keccak256("schema1");

        target.create(id);
        target.attachToSchema(id, schema);

        (bool hasSchema, bytes32 schemaId) = target.getSchema(id);
        assertTrue(hasSchema);
        assertEq(schemaId, schema);
    }

    function test_attachToSchema_emits_event() public {
        bytes32 id = keccak256("page1");
        bytes32 schema = keccak256("schema1");

        target.create(id);

        vm.expectEmit(true, false, false, true);
        emit SchemaAttached(id, schema);

        target.attachToSchema(id, schema);
    }

    function test_attachToSchema_zero_schema_reverts() public {
        bytes32 id = keccak256("page1");
        target.create(id);

        vm.expectRevert("Schema ID cannot be zero");
        target.attachToSchema(id, bytes32(0));
    }

    function test_detachFromSchema_removes_schema() public {
        bytes32 id = keccak256("page1");
        bytes32 schema = keccak256("schema1");

        target.create(id);
        target.attachToSchema(id, schema);
        target.detachFromSchema(id);

        (bool hasSchema,) = target.getSchema(id);
        assertFalse(hasSchema);
    }

    function test_detachFromSchema_emits_event() public {
        bytes32 id = keccak256("page1");
        bytes32 schema = keccak256("schema1");

        target.create(id);
        target.attachToSchema(id, schema);

        vm.expectEmit(true, false, false, false);
        emit SchemaDetached(id);

        target.detachFromSchema(id);
    }

    function test_detachFromSchema_no_schema_reverts() public {
        bytes32 id = keccak256("page1");
        target.create(id);

        vm.expectRevert("No schema attached");
        target.detachFromSchema(id);
    }

    // --- getBody tests ---

    function test_getBody_nonexistent_page_reverts() public {
        vm.expectRevert("Page not found");
        target.getBody(keccak256("missing"));
    }

    function test_getBody_empty_returns_empty_array() public {
        bytes32 id = keccak256("page1");
        target.create(id);

        bytes32[] memory body = target.getBody(id);
        assertEq(body.length, 0);
    }
}
