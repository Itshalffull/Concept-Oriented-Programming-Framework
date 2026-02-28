// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Attribution.sol";

contract AttributionTest is Test {
    Attribution public target;

    event Attributed(bytes32 indexed attributionId, bytes32 indexed contentRef, bytes32 indexed agent);
    event OwnershipSet(bytes32 indexed pattern);

    function setUp() public {
        target = new Attribution();
    }

    // --- attribute tests ---

    function test_attribute_stores_record() public {
        bytes32 contentRef = keccak256("doc1");
        bytes memory region = abi.encodePacked(uint256(0), uint256(100));
        bytes32 agent = keccak256("alice");
        bytes32 changeRef = keccak256("commit-abc");

        bytes32 attrId = target.attribute(contentRef, region, agent, changeRef);

        Attribution.AttributionRecord memory rec = target.getAttribution(attrId);
        assertEq(rec.contentRef, contentRef);
        assertEq(rec.agent, agent);
        assertEq(rec.changeRef, changeRef);
        assertTrue(rec.exists);
    }

    function test_attribute_emits_event() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 agent = keccak256("alice");

        vm.expectEmit(false, true, true, false);
        emit Attributed(bytes32(0), contentRef, agent);

        target.attribute(contentRef, "", agent, keccak256("c1"));
    }

    function test_attribute_zero_contentRef_reverts() public {
        vm.expectRevert("Content ref cannot be zero");
        target.attribute(bytes32(0), "", keccak256("alice"), keccak256("c1"));
    }

    function test_attribute_zero_agent_reverts() public {
        vm.expectRevert("Agent cannot be zero");
        target.attribute(keccak256("doc1"), "", bytes32(0), keccak256("c1"));
    }

    function test_attribute_increments_count() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 agent = keccak256("alice");

        target.attribute(contentRef, "", agent, keccak256("c1"));
        target.attribute(contentRef, "", agent, keccak256("c2"));

        assertEq(target.getAttributionCount(), 2);
    }

    // --- blame tests ---

    function test_blame_returns_attributions_for_content() public {
        bytes32 contentRef = keccak256("doc1");
        bytes32 agent1 = keccak256("alice");
        bytes32 agent2 = keccak256("bob");

        bytes32 id1 = target.attribute(contentRef, "line1", agent1, keccak256("c1"));
        bytes32 id2 = target.attribute(contentRef, "line2", agent2, keccak256("c2"));

        bytes32[] memory result = target.blame(contentRef);
        assertEq(result.length, 2);
        assertEq(result[0], id1);
        assertEq(result[1], id2);
    }

    function test_blame_empty_for_unknown_content() public view {
        bytes32[] memory result = target.blame(keccak256("unknown"));
        assertEq(result.length, 0);
    }

    // --- history tests ---

    function test_history_filters_by_region() public {
        bytes32 contentRef = keccak256("doc1");
        bytes memory region1 = "line1";
        bytes memory region2 = "line2";

        bytes32 id1 = target.attribute(contentRef, region1, keccak256("alice"), keccak256("c1"));
        target.attribute(contentRef, region2, keccak256("bob"), keccak256("c2"));
        bytes32 id3 = target.attribute(contentRef, region1, keccak256("carol"), keccak256("c3"));

        bytes32[] memory result = target.history(contentRef, region1);
        assertEq(result.length, 2);
        assertEq(result[0], id1);
        assertEq(result[1], id3);
    }

    function test_history_empty_for_unmatched_region() public {
        bytes32 contentRef = keccak256("doc1");
        target.attribute(contentRef, "line1", keccak256("alice"), keccak256("c1"));

        bytes32[] memory result = target.history(contentRef, "line99");
        assertEq(result.length, 0);
    }

    // --- setOwnership tests ---

    function test_setOwnership_stores_owners() public {
        bytes32 pattern = keccak256("src/**/*.ts");
        bytes32[] memory owners = new bytes32[](2);
        owners[0] = keccak256("alice");
        owners[1] = keccak256("bob");

        target.setOwnership(pattern, owners);

        bytes32[] memory result = target.queryOwners(pattern);
        assertEq(result.length, 2);
        assertEq(result[0], owners[0]);
        assertEq(result[1], owners[1]);
    }

    function test_setOwnership_emits_event() public {
        bytes32 pattern = keccak256("src/**");
        bytes32[] memory owners = new bytes32[](1);
        owners[0] = keccak256("alice");

        vm.expectEmit(true, false, false, false);
        emit OwnershipSet(pattern);

        target.setOwnership(pattern, owners);
    }

    function test_setOwnership_zero_pattern_reverts() public {
        bytes32[] memory owners = new bytes32[](1);
        owners[0] = keccak256("alice");

        vm.expectRevert("Pattern cannot be zero");
        target.setOwnership(bytes32(0), owners);
    }

    function test_setOwnership_empty_owners_reverts() public {
        bytes32[] memory owners = new bytes32[](0);

        vm.expectRevert("Owners list cannot be empty");
        target.setOwnership(keccak256("pattern"), owners);
    }

    // --- queryOwners tests ---

    function test_queryOwners_reverts_for_unset_pattern() public {
        vm.expectRevert("Ownership not set for pattern");
        target.queryOwners(keccak256("unknown"));
    }

    // --- getAttribution tests ---

    function test_getAttribution_reverts_for_nonexistent() public {
        vm.expectRevert("Attribution does not exist");
        target.getAttribution(keccak256("nonexistent"));
    }
}
