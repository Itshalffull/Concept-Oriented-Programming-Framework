// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Pathauto.sol";

contract PathautoTest is Test {
    Pathauto public target;

    event AliasGenerated(bytes32 indexed nodeId, string slug);

    function setUp() public {
        target = new Pathauto();
    }

    // --- generateAlias tests ---

    function test_generateAlias_creates_slug() public {
        bytes32 nodeId = keccak256("node1");
        target.generateAlias(nodeId, "Hello World");

        (bool found, string memory slug) = target.getAlias(nodeId);
        assertTrue(found, "Alias should exist");
        assertEq(slug, "hello-world", "Slug should be lowercased with hyphens");
    }

    function test_generateAlias_strips_special_chars() public {
        bytes32 nodeId = keccak256("node1");
        target.generateAlias(nodeId, "Hello, World! @2024");

        (bool found, string memory slug) = target.getAlias(nodeId);
        assertTrue(found);
        assertEq(slug, "hello-world-2024", "Special chars should be stripped");
    }

    function test_generateAlias_emits_event() public {
        bytes32 nodeId = keccak256("node1");

        vm.expectEmit(true, false, false, true);
        emit AliasGenerated(nodeId, "hello");

        target.generateAlias(nodeId, "Hello");
    }

    function test_generateAlias_zero_id_reverts() public {
        vm.expectRevert("Node ID cannot be zero");
        target.generateAlias(bytes32(0), "title");
    }

    function test_generateAlias_empty_title_reverts() public {
        vm.expectRevert("Title cannot be empty");
        target.generateAlias(keccak256("node1"), "");
    }

    function test_generateAlias_overwrites_existing() public {
        bytes32 nodeId = keccak256("node1");
        target.generateAlias(nodeId, "First Title");
        target.generateAlias(nodeId, "Second Title");

        (, string memory slug) = target.getAlias(nodeId);
        assertEq(slug, "second-title", "Alias should be overwritten");
    }

    // --- getAlias tests ---

    function test_getAlias_missing_returns_false() public view {
        (bool found, string memory slug) = target.getAlias(keccak256("missing"));
        assertFalse(found, "Missing alias should return false");
        assertEq(bytes(slug).length, 0, "Slug should be empty");
    }

    // --- hasAlias tests ---

    function test_hasAlias_false_for_missing() public view {
        assertFalse(target.hasAlias(keccak256("missing")), "Missing node should not have alias");
    }

    function test_hasAlias_true_after_generate() public {
        bytes32 nodeId = keccak256("node1");
        target.generateAlias(nodeId, "Title");
        assertTrue(target.hasAlias(nodeId), "Node should have alias after generate");
    }
}
