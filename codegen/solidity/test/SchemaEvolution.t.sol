// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SchemaEvolution.sol";

contract SchemaEvolutionTest is Test {
    SchemaEvolution public target;

    event SchemaRegistered(bytes32 indexed schemaId, bytes32 indexed subject, uint256 version);
    event CompatibilityChecked(bytes32 indexed oldSchemaId, bytes32 indexed newSchemaId, bool compatible);
    event SchemaUpcast(bytes32 indexed subject, uint256 fromVersion, uint256 toVersion);

    function setUp() public {
        target = new SchemaEvolution();
    }

    // --- register tests ---

    function test_register_first_schema_gets_version_1() public {
        (uint256 version, bytes32 schemaId) = target.register("user-events", hex"aabb", "backward");

        assertEq(version, 1);
        assertTrue(schemaId != bytes32(0));
    }

    function test_register_second_schema_gets_version_2() public {
        target.register("user-events", hex"aabb", "backward");
        (uint256 version,) = target.register("user-events", hex"ccdd", "backward");

        assertEq(version, 2);
    }

    function test_register_different_subjects_independent_versions() public {
        (uint256 v1,) = target.register("users", hex"aa", "backward");
        (uint256 v2,) = target.register("orders", hex"bb", "forward");

        assertEq(v1, 1);
        assertEq(v2, 1);
    }

    function test_register_emits_event() public {
        bytes32 subjectHash = keccak256(abi.encodePacked("user-events"));

        vm.expectEmit(false, true, false, true);
        emit SchemaRegistered(bytes32(0), subjectHash, 1);

        target.register("user-events", hex"aabb", "backward");
    }

    // --- getSchema tests ---

    function test_getSchema_returns_correct_data() public {
        target.register("user-events", hex"aabb", "backward");

        (bytes memory schema, string memory compat) = target.getSchema("user-events", 1);
        assertEq(schema, hex"aabb");
        assertEq(keccak256(bytes(compat)), keccak256(bytes("backward")));
    }

    function test_getSchema_returns_specific_version() public {
        target.register("user-events", hex"aabb", "backward");
        target.register("user-events", hex"ccdd", "full");

        (bytes memory schema1,) = target.getSchema("user-events", 1);
        (bytes memory schema2, string memory compat2) = target.getSchema("user-events", 2);

        assertEq(schema1, hex"aabb");
        assertEq(schema2, hex"ccdd");
        assertEq(keccak256(bytes(compat2)), keccak256(bytes("full")));
    }

    function test_getSchema_not_found_reverts() public {
        vm.expectRevert("Schema not found");
        target.getSchema("nonexistent", 1);
    }

    // --- latestVersion tests ---

    function test_latestVersion_zero_when_none() public {
        assertEq(target.latestVersion("unknown"), 0);
    }

    function test_latestVersion_tracks_registrations() public {
        target.register("user-events", hex"aa", "backward");
        target.register("user-events", hex"bb", "backward");
        target.register("user-events", hex"cc", "backward");

        assertEq(target.latestVersion("user-events"), 3);
    }

    // --- check tests ---

    function test_check_none_mode_returns_compatible() public {
        (, bytes32 id1) = target.register("subj", hex"aa", "none");
        (, bytes32 id2) = target.register("subj", hex"bb", "none");

        bool result = target.check(id1, id2, "none");
        assertTrue(result);
    }

    function test_check_backward_mode_returns_incompatible() public {
        (, bytes32 id1) = target.register("subj", hex"aa", "backward");
        (, bytes32 id2) = target.register("subj", hex"bb", "backward");

        bool result = target.check(id1, id2, "backward");
        assertFalse(result);
    }

    function test_check_old_schema_not_found_reverts() public {
        (, bytes32 id2) = target.register("subj", hex"bb", "backward");

        vm.expectRevert("Old schema not found");
        target.check(keccak256("missing"), id2, "backward");
    }

    function test_check_new_schema_not_found_reverts() public {
        (, bytes32 id1) = target.register("subj", hex"aa", "backward");

        vm.expectRevert("New schema not found");
        target.check(id1, keccak256("missing"), "backward");
    }

    // --- upcast tests ---

    function test_upcast_returns_target_schema() public {
        target.register("subj", hex"aa", "backward");
        target.register("subj", hex"bbcc", "backward");

        bytes memory data = target.upcast("subj", 1, 2);
        assertEq(data, hex"bbcc");
    }

    function test_upcast_invalid_fromVersion_reverts() public {
        target.register("subj", hex"aa", "backward");

        vm.expectRevert("Invalid fromVersion");
        target.upcast("subj", 0, 1);
    }

    function test_upcast_invalid_toVersion_reverts() public {
        target.register("subj", hex"aa", "backward");

        vm.expectRevert("Invalid toVersion");
        target.upcast("subj", 1, 5);
    }

    function test_upcast_to_not_greater_than_from_reverts() public {
        target.register("subj", hex"aa", "backward");
        target.register("subj", hex"bb", "backward");

        vm.expectRevert("toVersion must be greater than fromVersion");
        target.upcast("subj", 2, 1);
    }

    function test_upcast_emits_event() public {
        target.register("subj", hex"aa", "backward");
        target.register("subj", hex"bb", "backward");

        bytes32 subjectHash = keccak256(abi.encodePacked("subj"));

        vm.expectEmit(true, false, false, true);
        emit SchemaUpcast(subjectHash, 1, 2);

        target.upcast("subj", 1, 2);
    }
}
