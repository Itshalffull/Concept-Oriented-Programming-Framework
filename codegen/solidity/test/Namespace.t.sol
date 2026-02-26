// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Namespace.sol";

contract NamespaceTest is Test {
    Namespace public target;

    event PageCreated(bytes32 indexed pageId, string fullPath);
    event PageMoved(bytes32 indexed pageId, bytes32 indexed newParentId);

    function setUp() public {
        target = new Namespace();
    }

    // --- createPage tests ---

    function test_createPage_stores_root_page() public {
        bytes32 pageId = keccak256("home");
        target.createPage(pageId, "/home", bytes32(0));

        Namespace.Page memory p = target.getPage(pageId);
        assertEq(p.fullPath, "/home", "Path should match");
        assertEq(p.parentId, bytes32(0), "Root page should have no parent");
        assertTrue(p.exists);
    }

    function test_createPage_stores_child_page() public {
        bytes32 parentId = keccak256("home");
        bytes32 childId = keccak256("about");
        target.createPage(parentId, "/home", bytes32(0));
        target.createPage(childId, "/home/about", parentId);

        Namespace.Page memory p = target.getPage(childId);
        assertEq(p.parentId, parentId, "Parent should match");

        bytes32[] memory children = target.getChildren(parentId);
        assertEq(children.length, 1, "Parent should have 1 child");
        assertEq(children[0], childId, "Child ID should match");
    }

    function test_createPage_emits_event() public {
        bytes32 pageId = keccak256("home");

        vm.expectEmit(true, false, false, true);
        emit PageCreated(pageId, "/home");

        target.createPage(pageId, "/home", bytes32(0));
    }

    function test_createPage_duplicate_reverts() public {
        bytes32 pageId = keccak256("home");
        target.createPage(pageId, "/home", bytes32(0));

        vm.expectRevert("Page already exists");
        target.createPage(pageId, "/home2", bytes32(0));
    }

    function test_createPage_empty_path_reverts() public {
        vm.expectRevert("Path cannot be empty");
        target.createPage(keccak256("p1"), "", bytes32(0));
    }

    function test_createPage_nonexistent_parent_reverts() public {
        vm.expectRevert("Parent page does not exist");
        target.createPage(keccak256("child"), "/child", keccak256("missing"));
    }

    // --- getChildren tests ---

    function test_getChildren_empty_for_leaf() public {
        bytes32 pageId = keccak256("leaf");
        target.createPage(pageId, "/leaf", bytes32(0));

        bytes32[] memory children = target.getChildren(pageId);
        assertEq(children.length, 0, "Leaf page should have no children");
    }

    // --- getPage tests ---

    function test_getPage_nonexistent_reverts() public {
        vm.expectRevert("Page does not exist");
        target.getPage(keccak256("missing"));
    }

    // --- movePage tests ---

    function test_movePage_updates_parent() public {
        bytes32 root1 = keccak256("root1");
        bytes32 root2 = keccak256("root2");
        bytes32 child = keccak256("child");
        target.createPage(root1, "/root1", bytes32(0));
        target.createPage(root2, "/root2", bytes32(0));
        target.createPage(child, "/root1/child", root1);

        target.movePage(child, root2);

        Namespace.Page memory p = target.getPage(child);
        assertEq(p.parentId, root2, "Parent should be updated");

        bytes32[] memory oldChildren = target.getChildren(root1);
        assertEq(oldChildren.length, 0, "Old parent should have no children");

        bytes32[] memory newChildren = target.getChildren(root2);
        assertEq(newChildren.length, 1, "New parent should have 1 child");
    }

    function test_movePage_nonexistent_page_reverts() public {
        vm.expectRevert("Page does not exist");
        target.movePage(keccak256("missing"), bytes32(0));
    }

    function test_movePage_nonexistent_new_parent_reverts() public {
        bytes32 pageId = keccak256("page");
        target.createPage(pageId, "/page", bytes32(0));

        vm.expectRevert("New parent does not exist");
        target.movePage(pageId, keccak256("missing"));
    }

    function test_movePage_self_parent_reverts() public {
        bytes32 pageId = keccak256("page");
        target.createPage(pageId, "/page", bytes32(0));

        vm.expectRevert("Page cannot be its own parent");
        target.movePage(pageId, pageId);
    }

    function test_movePage_to_root() public {
        bytes32 parent = keccak256("parent");
        bytes32 child = keccak256("child");
        target.createPage(parent, "/parent", bytes32(0));
        target.createPage(child, "/parent/child", parent);

        target.movePage(child, bytes32(0));

        Namespace.Page memory p = target.getPage(child);
        assertEq(p.parentId, bytes32(0), "Page should be at root level");
    }
}
