// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Renderer.sol";

contract RendererTest is Test {
    Renderer public target;

    event Rendered(bytes32 indexed elementId);
    event CacheInvalidated(bytes32 indexed elementId);

    function setUp() public {
        target = new Renderer();
    }

    // --- cacheRender tests ---

    function test_cacheRender_stores_output() public {
        bytes32 eid = keccak256("e1");
        target.cacheRender(eid, "<div>Hello</div>", "tag1,tag2");

        (bool found, string memory output) = target.getCachedRender(eid);
        assertTrue(found);
        assertEq(output, "<div>Hello</div>");
    }

    function test_cacheRender_emits_event() public {
        bytes32 eid = keccak256("e1");

        vm.expectEmit(true, false, false, false);
        emit Rendered(eid);

        target.cacheRender(eid, "<div>Hello</div>", "tag1");
    }

    function test_cacheRender_overwrites_existing() public {
        bytes32 eid = keccak256("e1");
        target.cacheRender(eid, "old output", "tag1");
        target.cacheRender(eid, "new output", "tag2");

        (bool found, string memory output) = target.getCachedRender(eid);
        assertTrue(found);
        assertEq(output, "new output");
    }

    // --- getCachedRender tests ---

    function test_getCachedRender_returns_false_for_unknown() public {
        bytes32 eid = keccak256("unknown");

        (bool found, string memory output) = target.getCachedRender(eid);
        assertFalse(found);
        assertEq(bytes(output).length, 0);
    }

    // --- invalidateCache tests ---

    function test_invalidateCache_removes_entry() public {
        bytes32 eid = keccak256("e1");
        target.cacheRender(eid, "<div>Hello</div>", "tag1");
        target.invalidateCache(eid);

        (bool found, string memory output) = target.getCachedRender(eid);
        assertFalse(found);
        assertEq(bytes(output).length, 0);
    }

    function test_invalidateCache_emits_event() public {
        bytes32 eid = keccak256("e1");
        target.cacheRender(eid, "output", "tag1");

        vm.expectEmit(true, false, false, false);
        emit CacheInvalidated(eid);

        target.invalidateCache(eid);
    }

    function test_invalidateCache_nonexistent_reverts() public {
        bytes32 eid = keccak256("nonexistent");

        vm.expectRevert("No cache entry exists");
        target.invalidateCache(eid);
    }
}
